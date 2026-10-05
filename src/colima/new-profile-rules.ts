/**
 * What a new profile may be made with, and what it is made with when nothing is said: the same
 * whether the user fills in the form or asks for one in an Ask AI conversation.
 */

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const newProfileLimits = {
  cpus: { min: 1, max: 64 },
  memoryGib: { min: 1, max: 512 },
  diskGib: { min: 10, max: 4096 },
} as const satisfies Record<string, Range>;

export const newProfileDefaults = {
  cpus: 2,
  memoryGib: 4,
  diskGib: 60,
  runtime: "docker",
  kubernetes: true,
} as const;

/** A k3s release, such as `v1.35.0+k3s1`: what colima's `--kubernetes-version` takes. */
export const k3sVersionPattern = /^v\d+\.\d+\.\d+\+k3s\d+$/;

export const rangeText = ({ min, max }: Range) => `${min} to ${max}`;

/** A name nobody has taken yet: `k8s`, then `k8s-2`, `k8s-3` and so on. */
export const suggestProfileName = (isTaken: (name: string) => boolean) => {
  for (let index = 1; ; index++) {
    const name = index === 1 ? "k8s" : `k8s-${index}`;

    if (!isTaken(name)) {
      return name;
    }
  }
};
