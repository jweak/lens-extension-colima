import { Button } from "@k8slens/element-components";
import { DashboardIcon, PlayArrowIcon, StopIcon } from "@k8slens/icon";
import { getInjectableBunch } from "@k8slens/injectable";
import {
  NavigatorBranchIndicator,
  NavigatorItemActions,
  NavigatorItemIcon,
  NavigatorItemLabel,
  navigatorItemIconSize,
  NavigatorLeafIndicator,
} from "@k8slens/navigator-components";
import {
  getNavigatorItemKind,
  getNavigatorItemKindInjectableBunch,
  type NavigatorItemProps,
  navigatorRootKind,
  useItemIsOpen,
} from "@k8slens/navigator-contracts";
import { useInject } from "@k8slens/use-inject";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { isWindows } from "../colima/platform";
import { presentVerbOf } from "../colima/colima-operations.injectable";
import { ColimaIcon } from "./colima-icon";
import { StatusIcon } from "./colima-page";
import { navigateToColimaInjectable } from "./colima-navigation.injectable";
import { profileActionsInjectable } from "./profile-actions.injectable";

interface ColimaNavigatorItem {
  readonly id: string;
  readonly name: string;
  readonly orderNumber: number;
}

interface DashboardNavigatorItem {
  readonly id: string;
  readonly name: string;
  readonly orderNumber: number;
}

interface ProfileNavigatorItem {
  readonly id: string;
  readonly name: string;
  readonly orderNumber: number;
}

export const colimaNavigatorItemKind = getNavigatorItemKind<ColimaNavigatorItem, []>()("colima");
export const dashboardNavigatorItemKind = getNavigatorItemKind<DashboardNavigatorItem, [colimaId: string]>()(
  "colima-dashboard",
);
export const profileNavigatorItemKind = getNavigatorItemKind<ProfileNavigatorItem, [colimaId: string]>()(
  "colima-profile",
);

const ColimaRow = ({ kind, ids }: NavigatorItemProps<ColimaNavigatorItem, typeof navigatorRootKind>) => {
  const navigateToColima = useInject(navigateToColimaInjectable)();
  const isOpen = useItemIsOpen(kind, ...ids);

  return (
    <>
      <NavigatorBranchIndicator isOpen={isOpen} />
      <NavigatorItemIcon>
        <ColimaIcon $size={navigatorItemIconSize} />
      </NavigatorItemIcon>
      <NavigatorItemLabel onClick={() => void navigateToColima()} $tooltip="Start, stop and create Colima clusters">
        Colima
      </NavigatorItemLabel>
    </>
  );
};

// Always the Colima tab, whatever the profiles are doing: a running profile's own row opens its cluster.
const DashboardRow = (_props: NavigatorItemProps<DashboardNavigatorItem, typeof colimaNavigatorItemKind>) => {
  const navigateToColima = useInject(navigateToColimaInjectable)();

  return (
    <>
      <NavigatorLeafIndicator />
      <NavigatorItemIcon>
        <DashboardIcon $size={navigatorItemIconSize} />
      </NavigatorItemIcon>
      <NavigatorItemLabel onClick={() => void navigateToColima()} $tooltip="Every Colima profile, and a new one">
        Dashboard
      </NavigatorItemLabel>
    </>
  );
};

// The one thing done to a profile most often, right on its row: start it, or stop it.
const ProfileQuickAction = observer(({ profile }: { readonly profile: string }) => {
  const actions = useInject(profileActionsInjectable)();

  if (actions.canStart(profile)) {
    return (
      <Button $interactive $onClick={() => actions.start(profile)} $tooltip={`Start ${profile}`}>
        <PlayArrowIcon $size="s" />
      </Button>
    );
  }

  if (actions.canStop(profile)) {
    return (
      <Button $interactive $onClick={() => actions.stop(profile)} $tooltip={`Stop ${profile}`}>
        <StopIcon $size="s" />
      </Button>
    );
  }

  return null;
});

const ProfileRow = observer(({ item }: NavigatorItemProps<ProfileNavigatorItem, typeof colimaNavigatorItemKind>) => {
  const navigateToColima = useInject(navigateToColimaInjectable)();
  const actions = useInject(profileActionsInjectable)();
  const profile = actions.profileOf(item.name);
  const operation = actions.operationOf(item.name);

  const openProfile = () => (actions.canOpenCluster(item.name) ? actions.openCluster(item.name) : void navigateToColima());

  return (
    <>
      <NavigatorLeafIndicator />
      <NavigatorItemIcon>
        <StatusIcon status={profile?.status} operation={operation} />
      </NavigatorItemIcon>
      <NavigatorItemLabel
        onClick={openProfile}
        $tooltip={
          operation
            ? `${presentVerbOf(operation.kind)} ${item.name}…`
            : `${item.name}: ${profile?.status ?? "Unknown"}${actions.canOpenCluster(item.name) ? ", click to open its cluster" : ""}`
        }
      >
        {item.name}
      </NavigatorItemLabel>
      <NavigatorItemActions>
        <ProfileQuickAction profile={item.name} />
      </NavigatorItemActions>
    </>
  );
});

// Just above Lens's own Extensions item, which sits at the very bottom.
const colimaItems = computed((): ColimaNavigatorItem[] =>
  isWindows() ? [] : [{ id: "colima", name: "Colima", orderNumber: 999_000 }],
);

// First under Colima, ahead of the profiles, which start at 10.
const dashboardItems = computed((): DashboardNavigatorItem[] => [{ id: "dashboard", name: "Dashboard", orderNumber: 0 }]);

export const colimaNavigatorItems = getInjectableBunch({
  colima: getNavigatorItemKindInjectableBunch({
    kind: colimaNavigatorItemKind,
    parentKind: navigatorRootKind,
    description: "Colima, near the bottom of the navigator: the Colima profiles on this machine.",

    items: {
      instantiate: () => async () => colimaItems,
    },

    Component: ColimaRow,
  }),

  dashboard: getNavigatorItemKindInjectableBunch({
    kind: dashboardNavigatorItemKind,
    parentKind: colimaNavigatorItemKind,
    description: "Colima's dashboard, first under Colima in the navigator: every profile, and creating a new one.",

    items: {
      instantiate: () => async () => dashboardItems,
    },

    Component: DashboardRow,
  }),

  profiles: getNavigatorItemKindInjectableBunch({
    kind: profileNavigatorItemKind,
    parentKind: colimaNavigatorItemKind,
    description: "Each Colima profile under Colima in the navigator, with whether it is running.",

    items: {
      instantiate: (di) => {
        const profiles = di.inject(colimaProfilesInjectable)();

        return async () =>
          computed(() =>
            (profiles.all.get() ?? []).map((profile, index): ProfileNavigatorItem => ({
              id: profile.name,
              name: profile.name,
              orderNumber: (index + 1) * 10,
            })),
          );
      },
    },

    Component: ProfileRow,
  }),
});
