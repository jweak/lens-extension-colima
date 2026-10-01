import { getInjectable2 } from "@k8slens/injectable";
import { openModalInjectionToken } from "@k8slens/modal-contracts";
import { openTerminalInjectionToken } from "@k8slens/terminal-contracts";
import { colimaClustersInjectable } from "../colima/colima-clusters.injectable";
import { colimaOperationsInjectable } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { deleteProfileModalKind } from "./delete-profile-modal.injectable";
import { profileShellTerminalKind } from "./profile-shell-terminal.injectable";

/**
 * Everything a row, a menu or a button can do to one profile, and what it needs to know to offer
 * it: one place, so the navigator, the Colima tab and the cluster menu offer the same things.
 */
export const profileActionsInjectable = getInjectable2({
  id: "colima-profile-actions",
  consumptions: [openModalInjectionToken, openTerminalInjectionToken],

  instantiate: (di) => {
    const profiles = di.inject(colimaProfilesInjectable)();
    const operations = di.inject(colimaOperationsInjectable)();
    const clusters = di.inject(colimaClustersInjectable)();
    const openDeleteModal = di.inject(openModalInjectionToken.for(deleteProfileModalKind).for(di.scopeIds))();
    const openShell = di.inject(openTerminalInjectionToken.for(profileShellTerminalKind).for(di.scopeIds))();

    const isRunning = (profile: string) => profiles.byName(profile)?.status === "Running";
    const isBusy = (profile: string) => operations.operationOf(profile) !== undefined;

    return () => ({
      profileOf: profiles.byName,
      operationOf: operations.operationOf,
      lastErrorOf: operations.lastErrorOf,
      dismissError: operations.dismissError,
      clusterOf: clusters.clusterOf,
      isOpeningCluster: clusters.isOpening,

      canStart: (profile: string) => !isBusy(profile) && profiles.byName(profile) !== undefined && !isRunning(profile),
      canStop: (profile: string) => !isBusy(profile) && isRunning(profile),
      canDelete: (profile: string) => !isBusy(profile) && profiles.byName(profile) !== undefined,
      canOpenShell: (profile: string) => !isBusy(profile) && isRunning(profile),
      // colima lists a profile as Running once its VM is up, while k3s is still being started in
      // it, and Lens knows the cluster from the kubeconfig before that: only once the start is
      // done is there a cluster to open.
      canOpenCluster: (profile: string) =>
        !isBusy(profile) &&
        isRunning(profile) &&
        profiles.byName(profile)?.kubernetes === true &&
        clusters.clusterOf(profile) !== undefined,

      start: (profile: string) => void operations.start(profile),
      stop: (profile: string) => void operations.stop(profile),
      openCluster: (profile: string) => void clusters.open(profile),
      openShell: (profile: string) => void openShell(profile),

      delete: async (profile: string) => {
        const answer = await openDeleteModal(profile);

        if (answer) {
          await operations.delete(profile, answer);
        }
      },
    });
  },
});

export type ProfileActions = ReturnType<ReturnType<(typeof profileActionsInjectable)["instantiate"]>>;
