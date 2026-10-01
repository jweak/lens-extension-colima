import { ClickableDiv } from "@k8slens/element-components";
import { SpinnerIcon } from "@k8slens/icon";
import { getInjectable2 } from "@k8slens/injectable";
import { statusBarItemInjectionToken } from "@k8slens/status-bar-contracts";
import { useInject } from "@k8slens/use-inject";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { colimaOperationsInjectable } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { ColimaIcon } from "./colima-icon";
import { navigateToColimaInjectable } from "./colima-navigation.injectable";

const ColimaStatus = observer(() => {
  const profiles = useInject(colimaProfilesInjectable)();
  const operations = useInject(colimaOperationsInjectable)();
  const navigateToColima = useInject(navigateToColimaInjectable)();
  const summary = operations.summary.get();
  const running = profiles.running.get();
  const total = profiles.all.get()?.length ?? 0;

  return (
    <ClickableDiv
      $flex={{ gap: "xs", verticalAlign: "center" }}
      $padding={{ horizontal: "s" }}
      $onClick={() => void navigateToColima()}
      $tooltip={running.length > 0 ? `Running: ${running.map((profile) => profile.name).join(", ")}` : "Open Colima"}
    >
      {summary ? <SpinnerIcon $size="s" /> : <ColimaIcon $size="s" />}
      {summary ?? `Colima: ${running.length}/${total} running`}
    </ClickableDiv>
  );
});

/** How many colima profiles run, and what is starting or stopping, at the bottom of every view. */
export const colimaStatusBarItemInjectable = getInjectable2({
  id: "colima-status-bar-item",

  instantiate: (di) => {
    const profiles = di.inject(colimaProfilesInjectable)();

    return () => ({
      Component: ColimaStatus,
      position: "right" as const,
      orderNumber: 50,
      // Only once colima is found and has profiles: without colima there is nothing to report.
      isVisible: computed(
        () => profiles.availability.get().status === "available" && (profiles.all.get()?.length ?? 0) > 0,
      ),
    });
  },

  injectionToken: statusBarItemInjectionToken,
});
