import { getFeature, registerInjectablesFromModules } from "@k8slens/feature-core";
import modulesWithInjectables from "./**/*.injectable.(ts|tsx)";
import stylesheets from "./**/!(_*).(scss|css)";

export const colimaFeature = getFeature({
  id: "@k8slens/colima",
  register: (di) => {
    // Every `*.injectable.(ts|tsx)` file under src registers itself: each exported injectable
    // or bunch is picked up, so a new file needs no wiring here.
    registerInjectablesFromModules(di, [...modulesWithInjectables, ...stylesheets]);
  },
});
