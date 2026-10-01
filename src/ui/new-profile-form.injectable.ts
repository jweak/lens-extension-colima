import { getInjectable2 } from "@k8slens/injectable";
import { action, computed, observable, runInAction } from "mobx";
import { type ContainerRuntime, colimaOperationsInjectable, type NewProfile } from "../colima/colima-operations.injectable";
import { colimaDefaultsInjectable } from "../colima/colima-defaults.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { isValidProfileName } from "../colima/shell";

export type NewProfileField = "name" | "cpus" | "memoryGib" | "diskGib" | "kubernetesVersion";

const k3sVersionPattern = /^v\d+\.\d+\.\d+\+k3s\d+$/;

const wholeNumberIn = (text: string, min: number, max: number) => {
  const value = Number(text);

  return /^\d+$/.test(text.trim()) && value >= min && value <= max ? value : undefined;
};

const numberIn = (text: string, min: number, max: number) => {
  const value = Number(text);

  return /^\d+(\.\d+)?$/.test(text.trim()) && value >= min && value <= max ? value : undefined;
};

/**
 * What the new-profile modal asks, kept for as long as Lens runs, so the sizes picked last time are
 * offered again next time.
 */
export const newProfileFormInjectable = getInjectable2({
  id: "colima-new-profile-form",

  instantiate: (di) => {
    const profiles = di.inject(colimaProfilesInjectable)();
    const operations = di.inject(colimaOperationsInjectable)();
    const defaults = di.inject(colimaDefaultsInjectable)();

    return () => {
      const fields = observable.map<NewProfileField, string>({
        name: "",
        cpus: "2",
        memoryGib: "4",
        diskGib: "60",
        kubernetesVersion: "",
      });
      const runtime = observable.box<ContainerRuntime>("docker");
      const kubernetes = observable.box(true);

      const nameIsTaken = (name: string) =>
        profiles.byName(name) !== undefined || operations.operationOf(name) !== undefined;

      // A name nobody has taken yet, so that the form can be submitted as it opens.
      const suggestName = () => {
        for (let index = 1; ; index++) {
          const name = index === 1 ? "k8s" : `k8s-${index}`;

          if (!nameIsTaken(name)) {
            return name;
          }
        }
      };

      const valueOf = (field: NewProfileField) => fields.get(field) ?? "";

      const errors = computed(() => {
        const found: Partial<Record<NewProfileField, string>> = {};
        const name = valueOf("name").trim();

        if (!isValidProfileName(name)) {
          found.name = "Letters, digits, '.', '-' and '_', starting with a letter or a digit, at most 40 long.";
        } else if (nameIsTaken(name)) {
          found.name = `There is a profile called "${name}" already.`;
        }

        if (wholeNumberIn(valueOf("cpus"), 1, 64) === undefined) {
          found.cpus = "1 to 64";
        }

        if (numberIn(valueOf("memoryGib"), 1, 512) === undefined) {
          found.memoryGib = "1 to 512";
        }

        if (wholeNumberIn(valueOf("diskGib"), 10, 4096) === undefined) {
          found.diskGib = "10 to 4096";
        }

        const version = valueOf("kubernetesVersion").trim();

        if (kubernetes.get() && version !== "" && !k3sVersionPattern.test(version)) {
          found.kubernetesVersion = "A k3s release, like v1.35.0+k3s1";
        }

        return found;
      });

      return {
        valueOf,
        errorOf: (field: NewProfileField) => errors.get()[field],
        isValid: computed(() => Object.keys(errors.get()).length === 0),
        runtime: computed(() => runtime.get()),
        kubernetes: computed(() => kubernetes.get()),

        /**
         * Readies the form for another profile: a fresh name, the rest as picked last time, and the
         * Kubernetes version colima would use filled in, unless one was typed.
         */
        prepare: action(() => {
          fields.set("name", suggestName());

          void defaults.kubernetesVersion().then((version) =>
            runInAction(() => {
              if (version && valueOf("kubernetesVersion").trim() === "") {
                fields.set("kubernetesVersion", version);
              }
            }),
          );
        }),
        set: action((field: NewProfileField, value: string) => fields.set(field, value)),
        setRuntime: action((value: ContainerRuntime) => runtime.set(value)),
        toggleKubernetes: action(() => kubernetes.set(!kubernetes.get())),

        /** The profile the form describes, or undefined while it has errors. */
        toNewProfile: (): NewProfile | undefined =>
          Object.keys(errors.get()).length > 0
            ? undefined
            : {
                name: valueOf("name").trim(),
                cpus: Number(valueOf("cpus")),
                memoryGib: Number(valueOf("memoryGib")),
                diskGib: Number(valueOf("diskGib")),
                runtime: runtime.get(),
                kubernetes: kubernetes.get(),
                kubernetesVersion: valueOf("kubernetesVersion").trim() || undefined,
              },
      };
    };
  },
});

export type NewProfileForm = ReturnType<ReturnType<(typeof newProfileFormInjectable)["instantiate"]>>;
