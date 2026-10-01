import { clusterNavigatorItemKind } from "@k8slens/cluster-contracts";
import { type DropDownMenuItem, getDropDownMenuItemsInjectableBunch } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { ArrowForwardIcon, DeleteIcon, PlayArrowIcon, StopIcon, TerminalIcon } from "@k8slens/icon";
import { getInjectableBunch } from "@k8slens/injectable";
import {
  getNavigatorItemKindId,
  type NavigatorItem,
  navigatorItemDropDownMenuKind,
  navigatorItemDropDownMenuOrderNumbers as order,
} from "@k8slens/navigator-contracts";
import { useInject } from "@k8slens/use-inject";
import { computed } from "mobx";
import { colimaClustersInjectable } from "../colima/colima-clusters.injectable";
import { profileNavigatorItemKind } from "./colima-navigator-items.injectable";
import { type ProfileActions, profileActionsInjectable } from "./profile-actions.injectable";

type ProfileMenuAction = "start" | "stop" | "open-cluster" | "open-shell" | "delete";

interface ProfileMenuRowProps {
  readonly data: NavigatorItem;
  readonly profile: string;
  readonly action: ProfileMenuAction;
  readonly label: string;
}

const icons = {
  start: PlayArrowIcon,
  stop: StopIcon,
  "open-cluster": ArrowForwardIcon,
  "open-shell": TerminalIcon,
  delete: DeleteIcon,
} as const;

const perform = (actions: ProfileActions, action: ProfileMenuAction, profile: string) => {
  switch (action) {
    case "start":
      return actions.start(profile);
    case "stop":
      return actions.stop(profile);
    case "open-cluster":
      return actions.openCluster(profile);
    case "open-shell":
      return actions.openShell(profile);
    case "delete":
      return void actions.delete(profile);
  }
};

const ProfileMenuRow = ({ profile, action, label }: ProfileMenuRowProps) => {
  const actions = useInject(profileActionsInjectable)();

  return (
    <DropDownMenuItemRow Icon={icons[action]} $onClick={() => perform(actions, action, profile)}>
      {label}
    </DropDownMenuItemRow>
  );
};

type ProfileMenuItem = DropDownMenuItem<NavigatorItem, Omit<ProfileMenuRowProps, "data">>;

const rowOf = (id: string, orderNumber: number, props: Omit<ProfileMenuRowProps, "data">): ProfileMenuItem => ({
  id,
  orderNumber,
  Component: ProfileMenuRow,
  componentProps: props,
});

/**
 * What can be done to a profile, in the menu of its row under Colima in the navigator, and — for a
 * cluster Lens found in the kubeconfig that is a colima profile's Kubernetes — in the cluster's own
 * menu, so a stopped colima cluster can be started right where it is listed. Each row follows the
 * profile while the menu is open: Start turns into Stop once the profile runs.
 */
export const profileMenuItems = getInjectableBunch({
  profileRows: getDropDownMenuItemsInjectableBunch({
    id: "colima-profile-menu",
    kind: navigatorItemDropDownMenuKind,

    instantiate: (di) => {
      const actions = di.inject(profileActionsInjectable)();
      const profileKindId = getNavigatorItemKindId(profileNavigatorItemKind, di.scopeIds);

      return (item) => {
        if (item.kind !== profileKindId) {
          return [];
        }

        const profile = item.name;

        return computed(() => [
          ...(actions.canStart(profile) ? [rowOf("colima-profile-start", order.item, { profile, action: "start", label: "Start" })] : []),
          ...(actions.canStop(profile) ? [rowOf("colima-profile-stop", order.item, { profile, action: "stop", label: "Stop" })] : []),
          ...(actions.canOpenCluster(profile)
            ? [rowOf("colima-profile-open-cluster", order.item + 0.1, { profile, action: "open-cluster", label: "Open cluster" })]
            : []),
          ...(actions.canOpenShell(profile)
            ? [rowOf("colima-profile-open-shell", order.item + 0.2, { profile, action: "open-shell", label: "Open shell in VM" })]
            : []),
          ...(actions.canDelete(profile)
            ? [rowOf("colima-profile-delete", order.removal, { profile, action: "delete", label: "Delete" })]
            : []),
        ]);
      };
    },
  }),

  clusterRows: getDropDownMenuItemsInjectableBunch({
    id: "colima-cluster-menu",
    kind: navigatorItemDropDownMenuKind,

    instantiate: (di) => {
      const actions = di.inject(profileActionsInjectable)();
      const clusters = di.inject(colimaClustersInjectable)();
      // Lens's own kinds are registered under no scope.
      const clusterKindId = getNavigatorItemKindId(clusterNavigatorItemKind, []);

      return (item) => {
        if (item.kind !== clusterKindId) {
          return [];
        }

        return computed(() => {
          const profile = clusters.profileOfClusterName(item.name)?.name;

          if (profile === undefined) {
            return [];
          }

          // Next to Lens's own Connect and Disconnect: what makes the cluster there to connect to.
          return [
            ...(actions.canStart(profile)
              ? [rowOf("colima-cluster-start", order.item - 0.5, { profile, action: "start", label: "Start Colima VM" })]
              : []),
            ...(actions.canStop(profile)
              ? [rowOf("colima-cluster-stop", order.item + 0.5, { profile, action: "stop", label: "Stop Colima VM" })]
              : []),
          ];
        });
      };
    },
  }),
});
