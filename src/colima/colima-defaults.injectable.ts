import { getInjectable2 } from "@k8slens/injectable";
import { runColimaScriptInjectable } from "./run-colima-script.injectable";
import { parseDefaultKubernetesVersion, startHelpScript } from "./shell";

/**
 * What the installed colima starts a profile with when told nothing else, asked of colima itself
 * so it follows a colima upgrade. Asked once, the first time something wants it.
 */
export const colimaDefaultsInjectable = getInjectable2({
  id: "colima-defaults",

  instantiate: (di) => {
    const runScript = di.inject(runColimaScriptInjectable)();
    let kubernetesVersion: Promise<string | undefined> | undefined;

    return () => ({
      kubernetesVersion: () => {
        kubernetesVersion ??= runScript(startHelpScript).then((result) =>
          result.exitCode === 0 ? parseDefaultKubernetesVersion(result.output) : undefined,
        );

        return kubernetesVersion;
      },
    });
  },
});
