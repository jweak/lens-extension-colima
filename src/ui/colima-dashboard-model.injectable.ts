import type { Color } from "@k8slens/element-components";
import { getInjectable2 } from "@k8slens/injectable";
import { computed } from "mobx";
import { colimaOperationsInjectable } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { formatBytes } from "../colima/shell";

export interface DashboardStat {
  readonly label: string;
  readonly value: number;
  readonly color: Color;
}

const sum = (values: readonly (number | undefined)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

/** The figures the Colima dashboard leads with, worked out from the profiles as colima lists them. */
export const colimaDashboardModelInjectable = getInjectable2({
  id: "colima-dashboard-model",

  instantiate: (di) => {
    const profiles = di.inject(colimaProfilesInjectable)();
    const operations = di.inject(colimaOperationsInjectable)();

    const all = computed(() => profiles.all.get() ?? []);
    const isBusy = (name: string) => operations.operationOf(name) !== undefined;
    const running = computed(() => all.get().filter((profile) => profile.status === "Running"));
    const kubernetes = computed(() => all.get().filter((profile) => profile.kubernetes));

    return () => ({
      stats: computed((): DashboardStat[] => {
        const inProgress = all.get().filter((profile) => isBusy(profile.name)).length + operations.creating.get().length;

        return [
          { label: "Profiles", value: all.get().length, color: "grey10" },
          { label: "Running", value: running.get().length, color: "success" },
          { label: "Stopped", value: all.get().filter((profile) => profile.status === "Stopped").length, color: "grey20" },
          { label: "Broken", value: all.get().filter((profile) => profile.status === "Broken").length, color: "critical" },
          { label: "In progress", value: inProgress, color: "primary" },
        ];
      }),

      running: computed(() => ({ count: running.get().length, of: all.get().length })),

      /** Clusters ready to open: Kubernetes profiles that run, and are not starting or stopping. */
      clusters: computed(() => ({
        count: kubernetes.get().filter((profile) => profile.status === "Running" && !isBusy(profile.name)).length,
        of: kubernetes.get().length,
      })),

      /** What the running VMs have been given of this machine. */
      resources: computed(() => ({
        cpus: sum(running.get().map((profile) => profile.cpus)),
        memory: formatBytes(sum(running.get().map((profile) => profile.memory))) ?? "0 GiB",
        disk: formatBytes(sum(all.get().map((profile) => profile.disk))) ?? "0 GiB",
      })),
    });
  },
});
