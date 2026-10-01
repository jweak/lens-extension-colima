import { Div, Span } from "@k8slens/element-components";
import { getInjectable2 } from "@k8slens/injectable";
import { PlainButton } from "@k8slens/input-components";
import {
  showErrorNotificationInjectionToken,
  showSuccessNotificationInjectionToken,
} from "@k8slens/notifications-contracts";
import { action, computed, observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import { colimaClustersInjectable } from "./colima-clusters.injectable";
import { colimaProfilesInjectable } from "./colima-profiles.injectable";
import { runColimaScriptInjectable } from "./run-colima-script.injectable";
import { isValidProfileName, messageOfLog, operationScript, progressOfLog, progressScript } from "./shell";

export type OperationKind = "start" | "stop" | "delete" | "create";

export interface Operation {
  readonly kind: OperationKind;
  /** What colima said it is doing, as of its latest log line. */
  readonly progress?: string;
}

export type ContainerRuntime = "docker" | "containerd";

export interface NewProfile {
  readonly name: string;
  readonly cpus: number;
  readonly memoryGib: number;
  readonly diskGib: number;
  readonly runtime: ContainerRuntime;
  readonly kubernetes: boolean;
  /** A k3s version such as `v1.33.4+k3s1`; left out, the one colima defaults to. */
  readonly kubernetesVersion?: string;
}

const progressIntervalMs = 1500;

const verbs: Record<OperationKind, { readonly present: string; readonly past: string; readonly infinitive: string }> = {
  start: { present: "Starting", past: "is running", infinitive: "start" },
  stop: { present: "Stopping", past: "has stopped", infinitive: "stop" },
  delete: { present: "Deleting", past: "was deleted", infinitive: "delete" },
  create: { present: "Creating", past: "was created and is running", infinitive: "create" },
};

export const presentVerbOf = (kind: OperationKind) => verbs[kind].present;

interface StartedNotificationProps {
  readonly text: string;
  readonly hasCluster: () => boolean;
  readonly openCluster: () => void;
}

// Offers to open the cluster once Lens has picked it up from the kubeconfig, which colima has only
// just written: the button appears on its own when the cluster does.
const StartedNotification = observer(({ text, hasCluster, openCluster }: StartedNotificationProps) => (
  <Div $flex={{ direction: "vertical", gap: "s" }}>
    <Span>{text}</Span>
    {hasCluster() && (
      <Div $flex>
        <PlainButton onClick={openCluster}>Open cluster</PlainButton>
      </Div>
    )}
  </Div>
));

/**
 * What the user does to colima profiles: start, stop, delete and create them. Each runs colima in
 * the background, shows what colima is doing meanwhile, and says how it went.
 */
export const colimaOperationsInjectable = getInjectable2({
  id: "colima-operations",
  consumptions: [showSuccessNotificationInjectionToken, showErrorNotificationInjectionToken],

  instantiate: (di) => {
    const runScript = di.inject(runColimaScriptInjectable)();
    const profiles = di.inject(colimaProfilesInjectable)();
    const clusters = di.inject(colimaClustersInjectable)();
    const showSuccessNotification = di.inject(showSuccessNotificationInjectionToken)();
    const showErrorNotification = di.inject(showErrorNotificationInjectionToken)();

    const operations = observable.map<string, Operation>({}, { deep: false });
    const lastErrors = observable.map<string, string>();

    const setProgress = action((profile: string, progress: string | undefined) => {
      const operation = operations.get(profile);

      if (operation && progress && operation.progress !== progress) {
        operations.set(profile, { ...operation, progress });
      }
    });

    const followProgress = (profile: string) => {
      let polling = false;

      const timer = setInterval(async () => {
        if (polling) {
          return;
        }

        polling = true;

        try {
          const result = await runScript(progressScript(profile));

          setProgress(profile, progressOfLog(result.output));
        } finally {
          polling = false;
        }
      }, progressIntervalMs);

      return () => clearInterval(timer);
    };

    const announceSuccess = (profile: string, kind: OperationKind, kubernetes: boolean) => {
      const text = `Colima profile "${profile}" ${verbs[kind].past}.`;

      if ((kind === "start" || kind === "create") && kubernetes) {
        showSuccessNotification(
          <StartedNotification
            text={text}
            hasCluster={() => clusters.clusterOf(profile) !== undefined}
            openCluster={() => void clusters.open(profile)}
          />,
          { timeout: 15_000 },
        );
      } else {
        showSuccessNotification(text);
      }
    };

    const run = async (profile: string, kind: OperationKind, colimaArgs: readonly string[], kubernetes: boolean) => {
      if (!isValidProfileName(profile) || operations.has(profile)) {
        return false;
      }

      runInAction(() => {
        operations.set(profile, { kind });
        lastErrors.delete(profile);
      });

      const stopFollowing = followProgress(profile);

      try {
        const result = await runScript(operationScript(profile, colimaArgs));

        if (result.exitCode === 0) {
          announceSuccess(profile, kind, kubernetes);

          return true;
        }

        const message = messageOfLog(result.output) || `colima exited with code ${result.exitCode}`;

        runInAction(() => lastErrors.set(profile, message));
        showErrorNotification(`Colima could not ${verbs[kind].infinitive} "${profile}": ${message}`);

        return false;
      } finally {
        stopFollowing();
        await profiles.refresh();
        runInAction(() => operations.delete(profile));
      }
    };

    const kubernetesOf = (profile: string) => profiles.byName(profile)?.kubernetes ?? false;

    return () => ({
      operationOf: (profile: string) => operations.get(profile),
      lastErrorOf: (profile: string) => lastErrors.get(profile),
      dismissError: action((profile: string) => lastErrors.delete(profile)),

      /** Profiles being created that colima does not list yet. */
      creating: computed(() =>
        [...operations.entries()]
          .filter(([name, operation]) => operation.kind === "create" && !profiles.byName(name))
          .map(([name, operation]) => ({ name, operation })),
      ),

      /** One line on what is under way, for places with room for little else. */
      summary: computed(() => {
        const entries = [...operations.entries()];

        if (entries.length === 0) {
          return undefined;
        }

        const [name, operation] = entries[0]!;

        return entries.length === 1
          ? `${presentVerbOf(operation.kind)} ${name}…`
          : `${entries.length} profiles changing…`;
      }),

      start: (profile: string) => run(profile, "start", ["start", "--profile", profile], kubernetesOf(profile)),

      stop: (profile: string) => run(profile, "stop", ["stop", "--profile", profile], false),

      delete: (profile: string, { deleteData }: { readonly deleteData: boolean }) =>
        run(profile, "delete", ["delete", "--profile", profile, "--force", ...(deleteData ? ["--data"] : [])], false),

      create: (profile: NewProfile) =>
        run(
          profile.name,
          "create",
          [
            "start",
            "--profile",
            profile.name,
            "-c",
            String(profile.cpus),
            "-m",
            String(profile.memoryGib),
            "-d",
            String(profile.diskGib),
            "-r",
            profile.runtime,
            ...(profile.kubernetes ? ["--kubernetes"] : []),
            ...(profile.kubernetes && profile.kubernetesVersion ? ["--kubernetes-version", profile.kubernetesVersion] : []),
          ],
          profile.kubernetes,
        ),

    });
  },
});

export type ColimaOperations = ReturnType<ReturnType<(typeof colimaOperationsInjectable)["instantiate"]>>;
