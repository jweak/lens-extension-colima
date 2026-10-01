import { Div } from "@k8slens/element-components";
import { mainViewTabHostKind } from "@k8slens/main-view-contracts";
import { getTabKind, getTabKindInjectableBunch } from "@k8slens/tab-contracts";
import { ColimaIcon } from "./colima-icon";
import { ColimaPage } from "./colima-page";

/** Colima has one tab, always this id: opening Colima again brings it to the front. */
export const colimaTabId = "colima";

export const colimaTabKind = getTabKind()("colima");

const ColimaTabTitle = () => (
  <Div $flex={{ direction: "horizontal", gap: "xs", verticalAlign: "center" }}>
    <ColimaIcon $size="s" />
    Colima
  </Div>
);

export const colimaTab = getTabKindInjectableBunch({
  tabHostKind: mainViewTabHostKind,
  kind: colimaTabKind,
  Component: ColimaPage,
  Title: ColimaTabTitle,
});
