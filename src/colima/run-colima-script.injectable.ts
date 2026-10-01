import { runCliCommandInjectionToken } from "@k8slens/cli-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { errorText, parseShellResult, type ShellResult } from "./shell";

/**
 * Runs one of the scripts of `shell.ts` through Lens's CLI token and hands back what it printed
 * together with its exit code, rather than a rejection that would lose colima's own explanation.
 */
export const runColimaScriptInjectable = getInjectable2({
  id: "colima-run-script",
  consumptions: [runCliCommandInjectionToken],

  instantiate: (di) => {
    const runCliCommand = di.inject(runCliCommandInjectionToken)();

    return () =>
      async (script: string): Promise<ShellResult> => {
        try {
          return parseShellResult(await runCliCommand(script));
        } catch (error) {
          // The shell itself could not be started.
          return { output: errorText(error), exitCode: 1 };
        }
      };
  },
});
