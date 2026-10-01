/**
 * Everything about talking to the colima CLI that is plain text in and plain text out: the shell
 * commands the extension runs, and how what they print is read back.
 */

/** What colima accepts as a profile name, kept strict because the name ends up in shell commands. */
const profileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export const isValidProfileName = (name: string) => profileNamePattern.test(name);

/** Anything made only of these needs no quoting in a POSIX shell. */
const plainWord = /^[A-Za-z0-9_\-.:/@=+,]+$/;

export const quote = (value: string) => (plainWord.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`);

/**
 * Lens started from the Dock or a desktop launcher does not always have Homebrew on its PATH, which
 * is where colima and the tools it drives (limactl, docker, kubectl) usually live: on macOS, and on
 * Linux in Homebrew's own home.
 */
const toolPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin", "$HOME/.linuxbrew/bin"];

const withToolPath = (script: string) => `PATH="$PATH:${toolPaths.join(":")}"; export PATH; ${script}`;

const exitCodeMarker = "__LENS_COLIMA_EXIT_CODE__";

/**
 * Lens rejects a command that writes anything to stderr, and colima writes all its logging there,
 * so every script merges stderr into stdout and ends by printing its exit code: the shell itself
 * always succeeds, and the caller gets both colima's own words and whether it succeeded.
 */
export const asScript = (script: string) => withToolPath(`${script}; echo "${exitCodeMarker}$?"`);

export interface ShellResult {
  readonly output: string;
  readonly exitCode: number;
}

export const parseShellResult = (stdout: string): ShellResult => {
  const index = stdout.lastIndexOf(exitCodeMarker);

  if (index === -1) {
    return { output: stdout.trim(), exitCode: 1 };
  }

  const exitCode = Number.parseInt(stdout.slice(index + exitCodeMarker.length).trim(), 10);

  return { output: stdout.slice(0, index).trim(), exitCode: Number.isNaN(exitCode) ? 1 : exitCode };
};

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Where colima keeps its profiles: $COLIMA_HOME, else ~/.colima, else the XDG location newer
// installations use.
const colimaHomeScript = [
  `home="$COLIMA_HOME"`,
  `[ -n "$home" ] || home="$HOME/.colima"`,
  `[ -d "$home" ] || home="$HOME/.config/colima"`,
].join("; ");

// Whether a profile's colima.yaml has `kubernetes: enabled: true`. A stopped profile says nothing
// about Kubernetes in `colima list`, so its configuration is the only place that knows.
const kubernetesEnabledAwk = `awk '/^kubernetes:/{s=1;next} s&&/^[^[:space:]#]/{s=0} s&&/^[[:space:]]+enabled:/{print $2;exit}'`;

const kubernetesMarker = "__LENS_COLIMA_KUBERNETES__";

export const versionScript = asScript("colima version 2>&1");

export const startHelpScript = asScript("colima start --help 2>&1");

/** The k3s release `colima start --kubernetes` uses when told none, as its help states it. */
export const parseDefaultKubernetesVersion = (help: string) =>
  /--kubernetes-version\s+string\b.*\(default "([^"]+)"\)/.exec(help)?.[1];

export const listScript = asScript(
  [
    `out="$(colima list --json 2>&1)"`,
    `code=$?`,
    `printf '%s\\n' "$out"`,
    colimaHomeScript,
    `for f in "$home"/*/colima.yaml; do [ -f "$f" ] || continue; p="$(basename "$(dirname "$f")")"; echo "${kubernetesMarker} $p $(${kubernetesEnabledAwk} "$f")"; done`,
    `(exit $code)`,
  ].join("; "),
);

const logFileOf = (profile: string) => `"$dir/lens-colima-${profile}.log"`;
const logDirScript = `dir="$TMPDIR"; [ -n "$dir" ] || dir=/tmp`;

/**
 * Runs a long colima command with its output going to a log file, which `progressScript` reads while
 * it runs. On failure the end of the log is printed, so the caller can say why.
 */
export const operationScript = (profile: string, colimaArgs: readonly string[]) =>
  asScript(
    [
      logDirScript,
      `colima ${colimaArgs.map(quote).join(" ")} >${logFileOf(profile)} 2>&1 </dev/null`,
      `code=$?`,
      `[ $code -eq 0 ] || tail -n 40 ${logFileOf(profile)}`,
      `(exit $code)`,
    ].join("; "),
  );

export const progressScript = (profile: string) =>
  asScript([logDirScript, `tail -n 5 ${logFileOf(profile)} 2>/dev/null || true`].join("; "));

export type ProfileStatus = "Running" | "Stopped" | "Broken" | (string & {});

export interface ColimaProfile {
  readonly name: string;
  readonly status: ProfileStatus;
  readonly arch?: string;
  readonly cpus?: number;
  /** In bytes. */
  readonly memory?: number;
  /** In bytes. */
  readonly disk?: number;
  readonly runtime?: string;
  readonly address?: string;
  readonly kubernetes: boolean;
}

interface ListedProfile {
  readonly name?: unknown;
  readonly status?: unknown;
  readonly arch?: unknown;
  readonly cpus?: unknown;
  readonly memory?: unknown;
  readonly disk?: unknown;
  readonly runtime?: unknown;
  readonly address?: unknown;
  readonly kubernetes?: unknown;
}

const stringOr = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
const numberOr = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

export type ListResult =
  | { readonly succeeded: true; readonly profiles: readonly ColimaProfile[] }
  | { readonly succeeded: false; readonly message: string };

export const parseListOutput = ({ output, exitCode }: ShellResult): ListResult => {
  const kubernetesByProfile = new Map<string, boolean>();
  const listed: ListedProfile[] = [];
  const otherLines: string[] = [];

  for (const line of output.split("\n").map((each) => each.trim())) {
    if (line.startsWith(kubernetesMarker)) {
      const [, profile, enabled] = line.split(/\s+/);

      if (profile) {
        kubernetesByProfile.set(profile, enabled === "true");
      }
    } else if (line.startsWith("{")) {
      try {
        listed.push(JSON.parse(line) as ListedProfile);
      } catch {
        otherLines.push(line);
      }
    } else if (line !== "") {
      otherLines.push(line);
    }
  }

  if (exitCode !== 0) {
    return { succeeded: false, message: messageOfLog(otherLines.join("\n")) || `colima list exited with ${exitCode}` };
  }

  const profiles = listed.flatMap((profile): ColimaProfile[] => {
    const name = stringOr(profile.name);

    if (!name) {
      return [];
    }

    const runtime = stringOr(profile.runtime);

    return [
      {
        name,
        status: stringOr(profile.status) ?? "Unknown",
        arch: stringOr(profile.arch),
        cpus: numberOr(profile.cpus),
        memory: numberOr(profile.memory),
        disk: numberOr(profile.disk),
        runtime,
        address: stringOr(profile.address),
        kubernetes:
          profile.kubernetes === true || kubernetesByProfile.get(name) === true || (runtime?.includes("k3s") ?? false),
      },
    ];
  });

  return { succeeded: true, profiles };
};

interface LogEntry {
  readonly level?: string;
  readonly message: string;
}

const unescape = (value: string) => value.replace(/\\(.)/g, "$1");

/** colima logs as `time="…" level=info msg="…"` when not writing to a terminal. */
const parseLogLine = (line: string): LogEntry | undefined => {
  const trimmed = line.trim();

  if (trimmed === "") {
    return undefined;
  }

  // A message of one word is not quoted: `msg=done`.
  const message = /msg=(?:"((?:[^"\\]|\\.)*)"|(\S+))/.exec(trimmed);
  const level = /level=(\w+)/.exec(trimmed)?.[1];

  return message ? { level, message: unescape(message[1] ?? message[2] ?? "") } : { message: trimmed };
};

const logEntriesOf = (log: string) => log.split("\n").flatMap((line) => parseLogLine(line) ?? []);

/** The line of a colima log worth showing as what it is doing now. */
export const progressOfLog = (log: string) => logEntriesOf(log).at(-1)?.message;

/** Why a colima command failed, from what it logged: its errors when it said any, else its last word. */
export const messageOfLog = (log: string) => {
  const entries = logEntriesOf(log);
  const errors = entries.filter((entry) => entry.level === "fatal" || entry.level === "error");

  // colima often logs the same failure as an error and then again as fatal.
  const messages = [...new Set((errors.length > 0 ? errors : entries.slice(-1)).map((entry) => entry.message))];

  return messages.slice(-2).join(": ");
};

/** The kubeconfig context, and so the Lens cluster name, colima gives a profile's Kubernetes. */
export const contextNameOf = (profile: string) => (profile === "default" ? "colima" : `colima-${profile}`);

/** The profile a kubeconfig context colima wrote belongs to, if it looks like one. */
export const profileOfContextName = (contextName: string) =>
  contextName === "colima" ? "default" : contextName.startsWith("colima-") ? contextName.slice("colima-".length) : undefined;

const gib = 1024 ** 3;

export const formatBytes = (bytes: number | undefined) => {
  if (bytes === undefined) {
    return undefined;
  }

  const value = bytes / gib;

  return `${Number.isInteger(value) ? value : value.toFixed(1)} GiB`;
};
