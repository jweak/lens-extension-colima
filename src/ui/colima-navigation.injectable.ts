import { getInjectable2 } from "@k8slens/injectable";
import { mainViewTabHostKind } from "@k8slens/main-view-contracts";
import {
  getNavigationTargetInjectableBunch,
  getNavigationTargetKind,
  isNavigationSupersededError,
  navigateToInjectionToken,
} from "@k8slens/navigation-contracts";
import { focusTabInjectionToken, openTabInjectionToken, tabIsOpenInjectionToken } from "@k8slens/tab-contracts";
import { colimaTabId, colimaTabKind } from "./colima-tab.injectable";

/** Colima as a place, so that going back from a cluster returns to it. */
export const colimaNavigationTargetKind = getNavigationTargetKind()("colima-extension-colima");

export const colimaNavigationTarget = getNavigationTargetInjectableBunch({
  kind: colimaNavigationTargetKind,

  navigate: {
    consumptions: [openTabInjectionToken, focusTabInjectionToken, tabIsOpenInjectionToken],

    instantiate: (di) => {
      const openTab = di.inject(openTabInjectionToken.for(mainViewTabHostKind).for(colimaTabKind).for(di.scopeIds))();
      const focusTab = di.inject(focusTabInjectionToken.for(mainViewTabHostKind).for(colimaTabKind).for(di.scopeIds))();
      const isOpen = di.inject(tabIsOpenInjectionToken.for(mainViewTabHostKind).for(colimaTabKind).for(di.scopeIds))();

      return () => async () => {
        if (await isOpen({ tabId: colimaTabId })) {
          await focusTab({ tabId: colimaTabId });
        } else {
          await openTab({ tabId: colimaTabId });
        }
      };
    },
  },

  describe: () => "Colima",
});

/** Opens Colima, or brings it to the front. */
export const navigateToColimaInjectable = getInjectable2({
  id: "colima-navigate-to-colima",
  consumptions: [navigateToInjectionToken],

  instantiate: (di) => {
    const navigateToColima = di.inject(navigateToInjectionToken.for(colimaNavigationTargetKind))();

    return () => async () => {
      try {
        await navigateToColima();
      } catch (error) {
        // The user went somewhere else before Colima was shown: not a failure.
        if (!isNavigationSupersededError(error)) {
          throw error;
        }
      }
    };
  },
});
