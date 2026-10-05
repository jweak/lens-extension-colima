import { getAskAiFunctionInjectableBunch, getAskAiFunctionKind } from "@k8slens/ask-ai-contracts";
import { getInjectableBunch } from "@k8slens/injectable";
import { colimaClustersInjectable } from "../colima/colima-clusters.injectable";
import { colimaDefaultsInjectable } from "../colima/colima-defaults.injectable";
import { colimaOperationsInjectable, type ContainerRuntime, type NewProfile } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import {
  k3sVersionPattern,
  newProfileDefaults,
  newProfileLimits,
  type Range,
  rangeText,
  suggestProfileName,
} from "../colima/new-profile-rules";
import { navigateToColimaInjectable } from "../ui/colima-navigation.injectable";
import { profileActionsInjectable } from "../ui/profile-actions.injectable";
import { askAiSupportInjectable, type ProfileSummary } from "./ask-ai-support.injectable";

/*
 * What Ask AI can do with Colima, in any conversation: list the profiles, start, stop and create
 * them, and open the dashboard, a profile's cluster or a shell in its VM. Deleting a profile is
 * left out on purpose: the assistant runs these without asking the user first.
 *
 * Starting, stopping and creating take from seconds to minutes, so those resolve as soon as colima
 * is under way. The rest of Lens shows the progress as it does for a click, and list-profiles
 * tells the assistant how it is going.
 */

const colimaIs =
  "Colima runs containers, and optionally a k3s Kubernetes cluster, in a lightweight VM on the user's own machine; each Colima profile is one such VM.";

const profileInput = "`profile` (string): the profile's name, as list-profiles reports it. The default profile is called `default`.";

interface ProfileInput {
  readonly profile: string;
}

interface NewProfileInput {
  readonly name?: string;
  readonly cpus?: number;
  readonly memoryGib?: number;
  readonly diskGib?: number;
  readonly runtime?: ContainerRuntime;
  readonly kubernetes?: boolean;
  readonly kubernetesVersion?: string;
}

interface CreatedProfile {
  readonly name: string;
  readonly cpus: number;
  readonly memoryGib: number;
  readonly diskGib: number;
  readonly runtime: ContainerRuntime;
  readonly kubernetes: boolean;
  readonly kubernetesVersion: string | null;
}

interface OpenedCluster {
  readonly cluster: { readonly id: string; readonly name: string };
}

export const listProfilesFunctionKind = getAskAiFunctionKind<
  void,
  { colimaVersion: string | null; profiles: ProfileSummary[] }
>()("list-profiles");
export const startProfileFunctionKind = getAskAiFunctionKind<ProfileInput, { status: "starting" | "already-running" }>()(
  "start-profile",
);
export const stopProfileFunctionKind = getAskAiFunctionKind<ProfileInput, { status: "stopping" | "already-stopped" }>()(
  "stop-profile",
);
export const createProfileFunctionKind = getAskAiFunctionKind<NewProfileInput, CreatedProfile>()("create-profile");
export const openDashboardFunctionKind = getAskAiFunctionKind()("open-dashboard");
export const openProfileClusterFunctionKind = getAskAiFunctionKind<ProfileInput, OpenedCluster>()("open-profile-cluster");
export const openProfileShellFunctionKind = getAskAiFunctionKind<ProfileInput>()("open-profile-shell");

// The assistant fills these in from the conversation, so it is told plainly what was wrong.
const numberFrom = (input: Record<string, unknown>, field: string, range: Range, whole: boolean, fallback: number) => {
  const raw = input[field];

  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  const value = typeof raw === "string" ? Number(raw.trim()) : raw;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < range.min ||
    value > range.max ||
    (whole && !Number.isInteger(value))
  ) {
    throw new Error(`\`${field}\` must be a ${whole ? "whole number" : "number"} from ${rangeText(range)}.`);
  }

  return value;
};

const runtimeFrom = (raw: unknown): ContainerRuntime => {
  if (raw === undefined || raw === null || raw === "") {
    return newProfileDefaults.runtime;
  }

  const value = typeof raw === "string" ? raw.trim().toLowerCase() : raw;

  if (value !== "docker" && value !== "containerd") {
    throw new Error("`runtime` must be `docker` or `containerd`.");
  }

  return value;
};

const kubernetesFrom = (raw: unknown) => {
  if (raw === undefined || raw === null) {
    return newProfileDefaults.kubernetes;
  }

  if (typeof raw !== "boolean") {
    throw new Error("`kubernetes` must be true or false.");
  }

  return raw;
};

const kubernetesVersionFrom = (raw: unknown) => {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }

  const text = typeof raw === "string" ? raw.trim() : "";
  const version = text.startsWith("v") ? text : `v${text}`;

  if (!k3sVersionPattern.test(version)) {
    throw new Error("`kubernetesVersion` must be a k3s release, such as v1.33.4+k3s1.");
  }

  return version;
};

export const colimaAskAiFunctions = getInjectableBunch({
  listProfiles: getAskAiFunctionInjectableBunch({
    kind: listProfilesFunctionKind,
    offeredIn: "every-conversation",
    description: `Lists the Colima profiles on the user's machine, as the Colima extension of Lens sees them. ${colimaIs} Use it to answer which Colima profiles or local Colima clusters there are, whether one is running, what colima is doing to it right now, and how big it is. Use it also before start-profile, stop-profile, open-profile-cluster or open-profile-shell when the user names a profile loosely, or means the cluster this conversation is about: that cluster's Lens cluster id equals the \`cluster.id\` of its profile.`,
    inputDescription: "Takes nothing.",
    outputDescription:
      "`colimaVersion` (string, or null when unknown): the installed colima's version. `profiles` (array), one object per profile: `name` (string, what the other functions take as `profile`); `status` (string: Running, Stopped, Broken, or Creating while create-profile is making it); `kubernetes` (boolean: whether it runs a k3s cluster); `runtime` (string or null: docker or containerd); `arch` (string or null); `cpus` (number or null); `memoryGib` and `diskGib` (number or null, in GiB); `inProgress` (null, or an object: `action` is start, stop, delete or create, and `progress` is a string or null, what colima last said it is doing); `lastError` (string or null: why the last start, stop or create of it failed); `cluster` (null, or an object: `id` is the Lens cluster id and `name` the Lens cluster name of the profile's Kubernetes cluster).",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const profiles = di.inject(colimaProfilesInjectable)();

        return () => async () => {
          const listed = await support.listNow();
          const availability = profiles.availability.get();

          return {
            colimaVersion: availability.status === "available" ? availability.version : null,
            profiles: [...listed.map(support.summaryOf), ...support.creating()],
          };
        };
      },
    },
  }),

  startProfile: getAskAiFunctionInjectableBunch({
    kind: startProfileFunctionKind,
    offeredIn: "every-conversation",
    description: `Starts a stopped Colima profile on the user's machine through the Colima extension of Lens: boots its VM and, when the profile has Kubernetes, its k3s cluster. ${colimaIs} Use it when the user asks to start, boot or bring up a Colima profile, a Colima VM or a local Colima cluster. It does not wait for the start, which takes a minute or more: Lens shows colima's progress and a notification once it is up, and list-profiles reports it done once \`status\` is Running and \`inProgress\` is null. For a profile that does not exist yet, use create-profile.`,
    inputDescription: profileInput,
    outputDescription:
      "`status` (string): `starting` when colima has been asked to start the profile, or `already-running` when it was running already and nothing was done.",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const operations = di.inject(colimaOperationsInjectable)();

        return () => async (input) => {
          const profile = await support.profileFrom(input);

          support.requireIdle(profile.name);

          if (profile.status === "Running") {
            return { status: "already-running" as const };
          }

          void operations.start(profile.name);

          return { status: "starting" as const };
        };
      },
    },
  }),

  stopProfile: getAskAiFunctionInjectableBunch({
    kind: stopProfileFunctionKind,
    offeredIn: "every-conversation",
    description: `Stops a running Colima profile on the user's machine through the Colima extension of Lens: shuts down its VM, and with it the containers and the k3s cluster running in it. ${colimaIs} Use it when the user asks to stop, shut down or halt a Colima profile, a Colima VM or a local Colima cluster, for one to free the CPUs and memory it holds. Nothing is deleted: start-profile brings the profile back as it was. It does not wait for the stop, which takes several seconds; list-profiles reports it done once \`status\` is Stopped and \`inProgress\` is null.`,
    inputDescription: profileInput,
    outputDescription:
      "`status` (string): `stopping` when colima has been asked to stop the profile, or `already-stopped` when it was not running and nothing was done.",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const operations = di.inject(colimaOperationsInjectable)();

        return () => async (input) => {
          const profile = await support.profileFrom(input);

          support.requireIdle(profile.name);

          if (profile.status !== "Running") {
            return { status: "already-stopped" as const };
          }

          void operations.stop(profile.name);

          return { status: "stopping" as const };
        };
      },
    },
  }),

  createProfile: getAskAiFunctionInjectableBunch({
    kind: createProfileFunctionKind,
    offeredIn: "every-conversation",
    description: `Creates a new Colima profile on the user's machine and starts it, through the Colima extension of Lens: a new VM running Docker or containerd and, unless told otherwise, a k3s Kubernetes cluster, which Lens then lists under Local Kubeconfigs. ${colimaIs} Use it when the user asks for a new local Kubernetes cluster, or a new Colima profile or VM. Every field may be left out, for the defaults of the extension's New profile form. It does not wait for the creation, which takes a few minutes: list-profiles shows the profile as Creating until colima lists it, then as Running once it is up. To start a profile that exists already, use start-profile.`,
    inputDescription: [
      "`name` (string, optional): the new profile's name, made of letters, digits, '.', '-' and '_', starting with a letter or a digit, at most 40 long, and not the name of another profile. Left out, the first free one of k8s, k8s-2, k8s-3 and so on.",
      `\`cpus\` (whole number, optional): ${rangeText(newProfileLimits.cpus)}, ${newProfileDefaults.cpus} when left out.`,
      `\`memoryGib\` (number, optional): memory in GiB, ${rangeText(newProfileLimits.memoryGib)}, ${newProfileDefaults.memoryGib} when left out.`,
      `\`diskGib\` (whole number, optional): disk in GiB, ${rangeText(newProfileLimits.diskGib)}, ${newProfileDefaults.diskGib} when left out.`,
      `\`runtime\` (string, optional): \`docker\` or \`containerd\`, ${newProfileDefaults.runtime} when left out.`,
      `\`kubernetes\` (boolean, optional): whether to run a k3s cluster in the VM, ${String(newProfileDefaults.kubernetes)} when left out.`,
      "`kubernetesVersion` (string, optional): the k3s release to run, such as v1.33.4+k3s1. Left out, the one the installed colima defaults to. Ignored without Kubernetes.",
    ].join(" "),
    outputDescription:
      "The profile being created: `name` (string), `cpus` (number), `memoryGib` (number), `diskGib` (number), `runtime` (string), `kubernetes` (boolean), and `kubernetesVersion` (string, or null without Kubernetes or when colima's default could not be found out).",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const operations = di.inject(colimaOperationsInjectable)();
        const defaults = di.inject(colimaDefaultsInjectable)();

        return () => async (rawInput) => {
          const input: Record<string, unknown> = typeof rawInput === "object" && rawInput !== null ? { ...rawInput } : {};
          const listed = await support.listNow();
          const isTaken = (name: string) =>
            listed.some((profile) => profile.name === name) || operations.operationOf(name) !== undefined;

          const givenName = typeof input.name === "string" ? input.name.trim() : "";
          const name = givenName === "" ? suggestProfileName(isTaken) : givenName;

          if (!support.isValidName(name)) {
            throw new Error(
              `"${name}" cannot be a Colima profile's name: use letters, digits, '.', '-' and '_', starting with a letter or a digit, at most 40 long.`,
            );
          }

          if (isTaken(name)) {
            throw new Error(`There is a Colima profile called "${name}" already. start-profile starts it.`);
          }

          const kubernetes = kubernetesFrom(input.kubernetes);
          const kubernetesVersion = kubernetes
            ? (kubernetesVersionFrom(input.kubernetesVersion) ?? (await defaults.kubernetesVersion()))
            : undefined;

          const profile: NewProfile = {
            name,
            cpus: numberFrom(input, "cpus", newProfileLimits.cpus, true, newProfileDefaults.cpus),
            memoryGib: numberFrom(input, "memoryGib", newProfileLimits.memoryGib, false, newProfileDefaults.memoryGib),
            diskGib: numberFrom(input, "diskGib", newProfileLimits.diskGib, true, newProfileDefaults.diskGib),
            runtime: runtimeFrom(input.runtime),
            kubernetes,
            kubernetesVersion,
          };

          void operations.create(profile);

          return { ...profile, kubernetesVersion: profile.kubernetesVersion ?? null };
        };
      },
    },
  }),

  openDashboard: getAskAiFunctionInjectableBunch({
    kind: openDashboardFunctionKind,
    offeredIn: "every-conversation",
    description: `Opens the Colima dashboard of the Colima extension in Lens, or brings it to the front: the tab with every Colima profile on the user's machine, its status, cluster and resources, and buttons to start, stop, create and delete profiles. ${colimaIs} Use it when the user asks to see, show or open Colima, the Colima dashboard or their Colima profiles in Lens. To answer about the profiles in the conversation instead, use list-profiles.`,
    inputDescription: "Takes nothing.",
    outputDescription: "Nothing. Resolves once the dashboard is shown.",
    invoke: {
      instantiate: (di) => {
        const navigateToColima = di.inject(navigateToColimaInjectable)();

        return () => () => navigateToColima();
      },
    },
  }),

  openProfileCluster: getAskAiFunctionInjectableBunch({
    kind: openProfileClusterFunctionKind,
    offeredIn: "every-conversation",
    description: `Opens the Kubernetes cluster of a running Colima profile in Lens, through the Colima extension: selects the cluster in Lens's navigator under Local Kubeconfigs, connects to it and opens it, for the user to browse its resources. ${colimaIs} Use it when the user asks to open, connect to or go to the cluster of a Colima profile. The profile must be running, with Kubernetes: start a stopped one with start-profile first, and wait until list-profiles reports it Running with \`inProgress\` null. Resolves once the cluster is open, which can take a few seconds while Lens connects.`,
    inputDescription: profileInput,
    outputDescription:
      "`cluster` (object): `id` (string), the Lens cluster id, and `name` (string), the Lens cluster name, of the cluster that was opened.",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const clusters = di.inject(colimaClustersInjectable)();

        return () => async (input) => {
          const profile = await support.profileFrom(input);

          support.requireIdle(profile.name);

          if (!profile.kubernetes) {
            throw new Error(`The Colima profile "${profile.name}" runs without Kubernetes, so it has no cluster to open.`);
          }

          if (profile.status !== "Running") {
            throw new Error(`The Colima profile "${profile.name}" is ${profile.status}. Start it with start-profile first.`);
          }

          const cluster = await clusters.goTo(profile.name);

          return { cluster: { id: cluster.id, name: cluster.name.get() } };
        };
      },
    },
  }),

  openProfileShell: getAskAiFunctionInjectableBunch({
    kind: openProfileShellFunctionKind,
    offeredIn: "every-conversation",
    description: `Opens a terminal tab in Lens with a shell inside the VM of a running Colima profile, through the Colima extension, as \`colima ssh\` would. ${colimaIs} Use it when the user asks for a shell, a terminal or an SSH session in a Colima VM. The profile must be running. It only opens the terminal and runs nothing in it.`,
    inputDescription: profileInput,
    outputDescription: "Nothing. Resolves once Lens has been asked to open the terminal tab.",
    invoke: {
      instantiate: (di) => {
        const support = di.inject(askAiSupportInjectable)();
        const actions = di.inject(profileActionsInjectable)();

        return () => async (input) => {
          const profile = await support.profileFrom(input);

          support.requireIdle(profile.name);

          if (profile.status !== "Running") {
            throw new Error(`The Colima profile "${profile.name}" is ${profile.status}. Start it with start-profile first.`);
          }

          actions.openShell(profile.name);
        };
      },
    },
  }),
});
