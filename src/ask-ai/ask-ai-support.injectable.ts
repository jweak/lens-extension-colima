import { getInjectable2 } from "@k8slens/injectable";
import { colimaClustersInjectable } from "../colima/colima-clusters.injectable";
import { colimaOperationsInjectable, type OperationKind, presentVerbOf } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { type ColimaProfile, isValidProfileName } from "../colima/shell";

/** One Colima profile as the assistant is told of it: plain JSON, sizes in GiB. */
export interface ProfileSummary {
  readonly name: string;
  readonly status: string;
  readonly kubernetes: boolean;
  readonly runtime: string | null;
  readonly arch: string | null;
  readonly cpus: number | null;
  readonly memoryGib: number | null;
  readonly diskGib: number | null;
  readonly inProgress: { readonly action: OperationKind; readonly progress: string | null } | null;
  readonly lastError: string | null;
  readonly cluster: { readonly id: string; readonly name: string } | null;
}

const gibOf = (bytes: number | undefined) => (bytes === undefined ? null : Math.round((bytes / 1024 ** 3) * 10) / 10);

/**
 * What every Ask AI function of the extension needs: the profiles as colima lists them right now,
 * one profile by the name the assistant gave, and how to describe one. The assistant may ask while
 * nothing in Lens shows Colima, when the profiles are not being polled, so each asks colima afresh.
 */
export const askAiSupportInjectable = getInjectable2({
  id: "colima-ask-ai-support",

  instantiate: (di) => {
    const profiles = di.inject(colimaProfilesInjectable)();
    const operations = di.inject(colimaOperationsInjectable)();
    const clusters = di.inject(colimaClustersInjectable)();

    const listNow = async () => {
      await profiles.refresh();

      const availability = profiles.availability.get();

      if (availability.status === "missing") {
        throw new Error(`Colima is not available on this machine: ${availability.message}`);
      }

      const listError = profiles.listError.get();

      if (listError) {
        throw new Error(`colima could not list its profiles: ${listError}`);
      }

      return profiles.all.get() ?? [];
    };

    const nameFrom = (input: unknown, field = "profile") => {
      const value = (input as Record<string, unknown> | undefined)?.[field];

      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`\`${field}\` is required: the name of a Colima profile, as list-profiles reports it.`);
      }

      return value.trim();
    };

    const summaryOf = (profile: ColimaProfile): ProfileSummary => {
      const operation = operations.operationOf(profile.name);
      const cluster = clusters.clusterOf(profile.name);

      return {
        name: profile.name,
        status: profile.status,
        kubernetes: profile.kubernetes,
        runtime: profile.runtime ?? null,
        arch: profile.arch ?? null,
        cpus: profile.cpus ?? null,
        memoryGib: gibOf(profile.memory),
        diskGib: gibOf(profile.disk),
        inProgress: operation ? { action: operation.kind, progress: operation.progress ?? null } : null,
        lastError: operations.lastErrorOf(profile.name) ?? null,
        cluster: cluster ? { id: cluster.id, name: cluster.name.get() } : null,
      };
    };

    return () => ({
      listNow,
      summaryOf,

      /** Profiles being created, which colima does not list until their VM is up. */
      creating: (): ProfileSummary[] =>
        operations.creating.get().map(({ name, operation }) => ({
          name,
          status: "Creating",
          kubernetes: false,
          runtime: null,
          arch: null,
          cpus: null,
          memoryGib: null,
          diskGib: null,
          inProgress: { action: operation.kind, progress: operation.progress ?? null },
          lastError: null,
          cluster: null,
        })),

      /** The profile the assistant named in `input.profile`, rejecting with the names there are when there is none. */
      profileFrom: async (input: unknown) => {
        const name = nameFrom(input);
        const all = await listNow();
        const profile = all.find((candidate) => candidate.name === name);

        if (!profile) {
          throw new Error(
            all.length === 0
              ? `There are no Colima profiles on this machine. create-profile makes one.`
              : `No Colima profile is called "${name}". The profiles are: ${all.map(({ name }) => name).join(", ")}.`,
          );
        }

        return profile;
      },

      /** Rejects while colima is already doing something to the profile, which it does one at a time. */
      requireIdle: (profile: string) => {
        const operation = operations.operationOf(profile);

        if (operation) {
          throw new Error(
            `Colima is already ${presentVerbOf(operation.kind).toLowerCase()} "${profile}". Wait until it is done; list-profiles shows how it is going.`,
          );
        }
      },

      isValidName: isValidProfileName,
    });
  },
});
