import { allClusterRecordsReactiveInjectionToken, type ClusterRecord } from "@k8slens/cluster-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { navigateToPodsInjectionToken } from "@k8slens/kubernetes-resources-contracts";
import { isNavigationSupersededError } from "@k8slens/navigation-contracts";
import { showErrorNotificationInjectionToken } from "@k8slens/notifications-contracts";
import { computed, type IComputedValue, observable, runInAction } from "mobx";
import { colimaProfilesInjectable } from "./colima-profiles.injectable";
import { contextNameOf, errorText, profileOfContextName } from "./shell";

/**
 * Which Lens cluster is a colima profile's Kubernetes. colima writes a kubeconfig context named
 * `colima` for the default profile and `colima-<profile>` for the others, and Lens names a cluster
 * it finds in the kubeconfig after its context, so the two meet by name.
 */
export const colimaClustersInjectable = getInjectable2({
  id: "colima-clusters",
  consumptions: [allClusterRecordsReactiveInjectionToken, navigateToPodsInjectionToken, showErrorNotificationInjectionToken],

  instantiate: (di) => {
    const allClusterRecords = di.inject(allClusterRecordsReactiveInjectionToken);
    const navigateToPods = di.inject(navigateToPodsInjectionToken)();
    const showErrorNotification = di.inject(showErrorNotificationInjectionToken)();
    const profiles = di.inject(colimaProfilesInjectable)();

    // Lens hands the records over once it knows of a cluster; until then there are none to read.
    const records = observable.box<IComputedValue<ClusterRecord[]> | undefined>(undefined, { deep: false });

    void allClusterRecords().then((recordsComputed) => runInAction(() => records.set(recordsComputed)));

    const byName = computed(() => new Map((records.get()?.get() ?? []).map((record) => [record.name.get(), record])));
    const opening = observable.box<string | undefined>(undefined);

    const clusterOf = (profile: string) => byName.get().get(contextNameOf(profile));

    return () => ({
      clusterOf,

      /** The profile a Lens cluster belongs to, when it is the Kubernetes of a profile colima knows. */
      profileOfClusterName: (clusterName: string) => {
        const profile = profileOfContextName(clusterName);

        return profile === undefined ? undefined : profiles.byName(profile);
      },

      isOpening: (profile: string) => opening.get() === profile,

      /** Takes the user into the profile's cluster, connecting it on the way. */
      open: async (profile: string) => {
        const cluster = clusterOf(profile);

        if (!cluster) {
          showErrorNotification(
            `Lens has no cluster called "${contextNameOf(profile)}" yet. Start the profile with Kubernetes enabled, and Lens picks the cluster up from your kubeconfig.`,
          );

          return;
        }

        runInAction(() => opening.set(profile));

        try {
          await navigateToPods({ clusterId: cluster.id, namespaces: "all" });
        } catch (error) {
          // The user went somewhere else before the cluster was shown: not a failure.
          if (!isNavigationSupersededError(error)) {
            showErrorNotification(`Lens could not open ${cluster.name.get()}: ${errorText(error)}`);
          }
        } finally {
          runInAction(() => {
            if (opening.get() === profile) {
              opening.set(undefined);
            }
          });
        }
      },
    });
  },
});
