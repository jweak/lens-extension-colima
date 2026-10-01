import { getInjectable2 } from "@k8slens/injectable";
import { computed, createAtom, observable, runInAction } from "mobx";
import { isWindows } from "./platform";
import { runColimaScriptInjectable } from "./run-colima-script.injectable";
import { type ColimaProfile, listScript, parseListOutput, versionScript } from "./shell";

export type ColimaAvailability =
  | { readonly status: "checking" }
  | { readonly status: "missing"; readonly message: string }
  | { readonly status: "available"; readonly version: string };

const pollIntervalMs = 8000;


/**
 * The colima profiles on this machine, as `colima list` reports them. Kept current by polling, but
 * only while something shows them: nothing runs while no view, row or indicator reads them.
 */
export const colimaProfilesInjectable = getInjectable2({
  id: "colima-profiles",

  instantiate: (di) => {
    const runScript = di.inject(runColimaScriptInjectable)();

    const availability = observable.box<ColimaAvailability>({ status: "checking" }, { deep: false });
    const profiles = observable.box<readonly ColimaProfile[] | undefined>(undefined, { deep: false });
    const listError = observable.box<string | undefined>(undefined);

    let inFlight: Promise<void> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    const checkAvailability = async () => {
      if (isWindows()) {
        runInAction(() => availability.set({ status: "missing", message: "Colima runs on macOS and Linux only." }));

        return;
      }

      const result = await runScript(versionScript);
      const version = /colima version (\S+)/.exec(result.output)?.[1];

      runInAction(() =>
        availability.set(
          result.exitCode === 0 && version
            ? { status: "available", version }
            : { status: "missing", message: result.output || "colima could not be run." },
        ),
      );
    };

    const list = async () => {
      const result = parseListOutput(await runScript(listScript));

      runInAction(() => {
        if (result.succeeded) {
          profiles.set(result.profiles);
          listError.set(undefined);
        } else {
          listError.set(result.message);
        }
      });
    };

    let queued: Promise<void> | undefined;

    const refreshNow = () => {
      inFlight = (async () => {
        if (availability.get().status !== "available") {
          await checkAvailability();
        }

        if (availability.get().status === "available") {
          await list();
        }
      })().finally(() => {
        inFlight = undefined;
      });

      return inFlight;
    };

    // A poll joins one under way; a refresh asked for after something changed waits for it and
    // lists again, since what is under way may have started before the change.
    const poll = () => inFlight ?? refreshNow();

    const refresh = (): Promise<void> => {
      if (!inFlight) {
        return refreshNow();
      }

      queued ??= inFlight.then(() => {
        queued = undefined;

        return refreshNow();
      });

      return queued;
    };

    // Observed from the first read by a view, unobserved when the last one goes away.
    const watched = createAtom(
      "colima-profiles-watched",
      () => {
        void poll();
        timer = setInterval(() => {
          if (availability.get().status === "available") {
            void poll();
          }
        }, pollIntervalMs);
      },
      () => {
        clearInterval(timer);
        timer = undefined;
      },
    );

    const all = computed(() => {
      watched.reportObserved();

      return profiles.get();
    });

    const byName = computed(() => new Map((all.get() ?? []).map((profile) => [profile.name, profile])));

    return () => ({
      availability: computed(() => {
        watched.reportObserved();

        return availability.get();
      }),
      /** Undefined until colima has been asked for the first time. */
      all,
      listError: computed(() => listError.get()),
      byName: (name: string) => byName.get().get(name),
      running: computed(() => (all.get() ?? []).filter((profile) => profile.status === "Running")),
      refresh,
      /** Asks again whether colima is installed, after the user has installed it. */
      checkAgain: async () => {
        runInAction(() => availability.set({ status: "checking" }));
        await refresh();
      },
    });
  },
});

export type ColimaProfiles = ReturnType<ReturnType<(typeof colimaProfilesInjectable)["instantiate"]>>;
