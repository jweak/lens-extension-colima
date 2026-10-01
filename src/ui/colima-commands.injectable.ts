import { getCommandInjectableBunch } from "@k8slens/command-palette-contracts";
import { getInjectableBunch } from "@k8slens/injectable";
import { isWindows } from "../colima/platform";
import { navigateToColimaInjectable } from "./colima-navigation.injectable";
import { createProfileInjectable } from "./new-profile-modal.injectable";

export const colimaCommands = getInjectableBunch({
  open: getCommandInjectableBunch({
    id: "colima.open",
    title: "Colima: Manage profiles",
    isActive: !isWindows(),

    action: {
      instantiate: (di) => {
        const navigateToColima = di.inject(navigateToColimaInjectable)();

        return () => () => navigateToColima();
      },
    },
  }),

  create: getCommandInjectableBunch({
    id: "colima.create-profile",
    title: "Colima: Create a Kubernetes cluster",
    isActive: !isWindows(),

    action: {
      instantiate: (di) => {
        const navigateToColima = di.inject(navigateToColimaInjectable)();
        const createProfile = di.inject(createProfileInjectable)();

        // The dashboard is where the new profile shows how its start is going.
        return () => async () => {
          if (await createProfile()) {
            await navigateToColima();
          }
        };
      },
    },
  }),
});
