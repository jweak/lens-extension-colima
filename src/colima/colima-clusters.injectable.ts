import {
  allClusterRecordsReactiveInjectionToken,
  type ClusterRecord,
  clusterNavigatorItemKind,
} from "@k8slens/cluster-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { isNavigationSupersededError } from "@k8slens/navigation-contracts";
import { navigateToNavigatorPlaceInjectionToken } from "@k8slens/navigator-contracts";
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
  consumptions: [
    allClusterRecordsReactiveInjectionToken,
    navigateToNavigatorPlaceInjectionToken,
    showErrorNotificationInjectionToken,
  ],

  instantiate: (di) => {
    const allClusterRecords = di.inject(allClusterRecordsReactiveInjectionToken);
    const navigateToNavigatorPlace = di.inject(navigateToNavigatorPlaceInjectionToken)();
    const showErrorNotification = di.inject(showErrorNotificationInjectionToken)();
    const profiles = di.inject(colimaProfilesInjectable)();

    // Lens hands the records over once it knows of a cluster; until then there are none to read.
    const records = observable.box<IComputedValue<ClusterRecord[]> | undefined>(undefined, { deep: false });

    void allClusterRecords().then((recordsComputed) => runInAction(() => records.set(recordsComputed)));

    const byName = computed(() => new Map((records.get()?.get() ?? []).map((record) => [record.name.get(), record])));
    const opening = observable.box<string | undefined>(undefined);

    const clusterOf = (profile: string) => byName.get().get(contextNameOf(profile));

    /**
     * Takes the user to the profile's cluster where it sits in the navigator, under Local
     * Kubeconfigs, and activates it as a click on it would: Lens connects the cluster, opens it,
     * and its resources are right there in the tree to browse. Rejects, saying why, when there is
     * no such cluster or Lens could not open it.
     */
    const goTo = async (profile: string) => {
      const cluster = clusterOf(profile);

      if (!cluster) {
        throw new Error(
          `Lens has no cluster called "${contextNameOf(profile)}" yet. Start the profile with Kubernetes enabled, and Lens picks the cluster up from your kubeconfig.`,
        );
      }

      runInAction(() => opening.set(profile));

      try {
        await navigateToNavigatorPlace({ kind: clusterNavigatorItemKind, ids: [cluster.id], activate: true });
      } catch (error) {
        // The user went somewhere else before the cluster was shown: not a failure.
        if (!isNavigationSupersededError(error)) {
          throw new Error(`Lens could not open ${cluster.name.get()}: ${errorText(error)}`);
        }
      } finally {
        runInAction(() => {
          if (opening.get() === profile) {
            opening.set(undefined);
          }
        });
      }

      return cluster;
    };

    return () => ({
      clusterOf,

      /** The profile a Lens cluster belongs to, when it is the Kubernetes of a profile colima knows. */
      profileOfClusterName: (clusterName: string) => {
        const profile = profileOfContextName(clusterName);

        return profile === undefined ? undefined : profiles.byName(profile);
      },

      isOpening: (profile: string) => opening.get() === profile,

      goTo,

      /** Like `goTo`, for a button: what goes wrong is shown to the user rather than rejected. */
      open: async (profile: string) => {
        try {
          await goTo(profile);
        } catch (error) {
          showErrorNotification(errorText(error));
        }
      },
    });
  },
});
