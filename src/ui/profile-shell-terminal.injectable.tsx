import { getTerminalInjectableBunch, getTerminalKind, type TerminalTabIconProps } from "@k8slens/terminal-contracts";
import { quote } from "../colima/shell";
import { ColimaIcon } from "./colima-icon";

/** A shell inside a colima profile's VM, opened with the profile's name. */
export const profileShellTerminalKind = getTerminalKind<[profile: string]>()("colima-ssh");

const ProfileShellTabIcon = ({ $size }: TerminalTabIconProps<[profile: string]>) => <ColimaIcon $size={$size} />;

export const profileShellTerminal = getTerminalInjectableBunch({
  kind: profileShellTerminalKind,
  TabIcon: ProfileShellTabIcon,

  startup: {
    instantiate: () => () => (profile) => ({
      title: `Colima: ${profile}`,
      command: `colima ssh --profile ${quote(profile)}`,
      reuseKey: profile,
    }),
  },
});
