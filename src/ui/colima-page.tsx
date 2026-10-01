import { Code, type Color, Div, H2, Span } from "@k8slens/element-components";
import { openLinkInBrowserInjectionToken } from "@k8slens/electron-contracts";
import {
  CircleIcon,
  CloseIcon,
  DeleteIcon,
  ErrorOutlineIcon,
  OpenInBrowserIcon,
  PlayArrowIcon,
  RefreshIcon,
  SpinnerIcon,
  StopIcon,
  TerminalIcon,
} from "@k8slens/icon";
import { PlainButton, PrimaryButton } from "@k8slens/input-components";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import type { ReactNode } from "react";
import { colimaOperationsInjectable, type Operation, presentVerbOf } from "../colima/colima-operations.injectable";
import { colimaProfilesInjectable } from "../colima/colima-profiles.injectable";
import { type ColimaProfile, contextNameOf, formatBytes } from "../colima/shell";
import { colimaDashboardModelInjectable } from "./colima-dashboard-model.injectable";
import { ColimaIcon } from "./colima-icon";
import { IconLabel, SecondaryButton } from "./components/buttons";
import { createProfileInjectable } from "./new-profile-modal.injectable";
import { profileActionsInjectable } from "./profile-actions.injectable";

const installationGuideUrl = "https://github.com/abiosoft/colima#installation";

/** The surface Lens's dashboards put their sections on: a shade lighter than the page, ruled round. */
const Card = ({ children, grow }: { readonly children: ReactNode; readonly grow?: boolean }) => (
  <Div
    $flex={{ direction: "vertical", gap: "m" }}
    $padding="l"
    $backgroundColor="grey80"
    $border={{ width: "xxs", color: "grey60", radius: "m" }}
    $flexChild={grow}
    $style={grow ? { minWidth: "240px" } : undefined}
  >
    {children}
  </Div>
);

const CardTitle = ({ icon, children }: { readonly icon?: ReactNode; readonly children: ReactNode }) => (
  <Div $flex={{ direction: "horizontal", gap: "s", verticalAlign: "center" }}>
    {icon && <Span $color="grey10">{icon}</Span>}
    <H2 $color="grey10" $font={{ size: "l", bold: "600" }}>
      {children}
    </H2>
  </Div>
);

const statusColorOf = (status: string | undefined): Color =>
  status === "Running" ? "success" : status === "Broken" ? "critical" : "grey25";

export const StatusIcon = ({ status, operation }: { readonly status?: string; readonly operation?: Operation }) =>
  operation ? <SpinnerIcon $size="s" $color="primary" /> : <CircleIcon $size="xs" $color={statusColorOf(status)} />;

// ——— The strip across the top: the figures at a glance, and what to do next ———

const SummaryStrip = observer(() => {
  const profiles = useInject(colimaProfilesInjectable)();
  const model = useInject(colimaDashboardModelInjectable)();
  const createProfile = useInject(createProfileInjectable)();
  const availability = profiles.availability.get();

  return (
    // As tall as the navigator's top bar, ruled off below rather than boxed, as Lens's dashboards are.
    <Div
      $flex={{ direction: "horizontal", gap: "xl", verticalAlign: "center", horizontalAlign: "space-between" }}
      $padding={{ horizontal: "xl" }}
      $backgroundColor="grey80"
      $border={{ bottom: { width: "xxs", color: "grey60" } }}
      $flexChild="fixed"
      $style={{ height: "45px" }}
    >
      <Div $flex={{ direction: "horizontal", gap: "xl", verticalAlign: "center" }}>
        {availability.status === "available" && profiles.all.get() !== undefined ? (
          model.stats.get().map((stat) => (
            <Div key={stat.label} $flex={{ direction: "horizontal", gap: "xs", verticalAlign: "center" }}>
              <Span $color={stat.color} $font={{ size: "s", bold: "600", noWrap: true }}>
                {stat.value}
              </Span>
              <Span $color="grey25" $font={{ size: "s", noWrap: true }}>
                {stat.label}
              </Span>
            </Div>
          ))
        ) : (
          <Span $color="grey25" $font={{ size: "s" }}>
            Colima
          </Span>
        )}
      </Div>

      {availability.status === "available" && (
        <Div $flex={{ direction: "horizontal", gap: "s", verticalAlign: "center" }}>
          <Span $color="grey25" $font={{ size: "s", noWrap: true }}>
            colima {availability.version}
          </Span>
          <SecondaryButton onClick={() => void profiles.refresh()}>
            <IconLabel Icon={RefreshIcon}>Refresh</IconLabel>
          </SecondaryButton>
          <PrimaryButton onClick={() => void createProfile()}>New profile</PrimaryButton>
        </Div>
      )}
    </Div>
  );
});

// ——— The cards: running profiles, clusters ready to open, what the VMs take ———

const Figure = ({ value, label }: { readonly value: ReactNode; readonly label: string }) => (
  <Div $flex={{ direction: "horizontal", gap: "xs", verticalAlign: "center" }}>
    <Span $color="grey20" $font={{ size: "xl", bold: "600" }}>
      {value}
    </Span>
    <Span $color="grey25" $font={{ size: "s" }}>
      {label}
    </Span>
  </Div>
);

interface Chip {
  readonly text: string;
  readonly color: Color;
}

const Chips = ({ chips }: { readonly chips: readonly Chip[] }) =>
  chips.length > 0 ? (
    <Div $flex={{ direction: "horizontal", gap: { column: "s", row: "xxs" }, wrap: true }}>
      {chips.map((chip) => (
        <Span key={chip.text} $color={chip.color} $font={{ size: "s" }}>
          {chip.text}
        </Span>
      ))}
    </Div>
  ) : null;

const SummaryCards = observer(() => {
  const model = useInject(colimaDashboardModelInjectable)();
  const stats = model.stats.get();
  const running = model.running.get();
  const clusters = model.clusters.get();
  const resources = model.resources.get();

  const chipsOf = (...labels: string[]): Chip[] =>
    stats
      .filter((stat) => labels.includes(stat.label) && stat.value > 0)
      .map((stat) => ({ text: `${stat.value} ${stat.label.toLowerCase()}`, color: stat.color }));

  return (
    <Div $flex={{ direction: "horizontal", gap: "l", wrap: true }}>
      <Card grow>
        <CardTitle icon={<ColimaIcon $size="m" />}>Profiles</CardTitle>
        <Figure value={`${running.count}/${running.of}`} label="running" />
        <Chips chips={chipsOf("Stopped", "Broken", "In progress")} />
      </Card>

      <Card grow>
        <CardTitle>Kubernetes</CardTitle>
        <Figure value={`${clusters.count}/${clusters.of}`} label="clusters up" />
      </Card>

      <Card grow>
        <CardTitle>Resources in use</CardTitle>
        <Figure value={`${resources.cpus} CPUs · ${resources.memory}`} label="by running VMs" />
        <Chips chips={[{ text: `${resources.disk} of disk across all profiles`, color: "grey25" }]} />
      </Card>
    </Div>
  );
});

// ——— The profiles, as a table ———

// Shares of the row each column takes, the same in the header and every row, so they line up.
const columns = { name: 3, status: 2, cluster: 3, runtime: 2, cpus: 1, memory: 1.5, disk: 1.5 } as const;

// Wide enough for Open cluster, Stop and the two icon buttons, so every row's actions line up.
const actionsWidth = { width: "calc(var(--unit) * 62)" };
const statusIconWidth = { width: "calc(var(--unit) * 6)" };

const Cell = ({ share, children, color = "grey20" }: {
  readonly share: number;
  readonly children: ReactNode;
  readonly color?: Color;
}) => (
  <Span $flexChild={share} $color={color} $font={{ noWrap: true, textOverflow: "ellipsis" }} $padding={{ left: "s", right: "s" }}>
    {children}
  </Span>
);

const HeaderCell = ({ share, children }: { readonly share: number; readonly children?: ReactNode }) => (
  <Span
    $flexChild={share}
    $color="grey10"
    $font={{ noWrap: true }}
    $padding={{ left: "s", right: "s" }}
    $border={{ left: { width: "xxs", color: "grey60" } }}
  >
    {children}
  </Span>
);

const TableHeader = () => (
  <Div
    $flex={{ direction: "horizontal", verticalAlign: "center" }}
    $padding={{ vertical: "s" }}
    $border={{ top: { width: "xxs", color: "grey60" }, bottom: { width: "xxs", color: "grey60" } }}
  >
    <Span $flexChild="fixed" $style={statusIconWidth} />
    <HeaderCell share={columns.name}>Name</HeaderCell>
    <HeaderCell share={columns.status}>Status</HeaderCell>
    <HeaderCell share={columns.cluster}>Cluster</HeaderCell>
    <HeaderCell share={columns.runtime}>Runtime</HeaderCell>
    <HeaderCell share={columns.cpus}>CPUs</HeaderCell>
    <HeaderCell share={columns.memory}>Memory</HeaderCell>
    <HeaderCell share={columns.disk}>Disk</HeaderCell>
    <Span $flexChild="fixed" $style={actionsWidth} $border={{ left: { width: "xxs", color: "grey60" } }} />
  </Div>
);

const rowBorder = { bottom: { width: "xxs", color: "grey60" }, exceptLast: true } as const;

// Under a row: what colima is doing with the profile, or why it failed, lined up with the name.
const RowNote = ({ children }: { readonly children: ReactNode }) => (
  <Div
    $flex={{ direction: "horizontal", gap: "xs", verticalAlign: "center" }}
    $padding={{ left: "s" }}
    $style={{ marginLeft: statusIconWidth.width }}
  >
    {children}
  </Div>
);

const ProgressNote = ({ operation }: { readonly operation: Operation }) => (
  <RowNote>
    <Span $color="grey25" $font={{ size: "s", noWrap: true, textOverflow: "ellipsis" }}>
      {operation.progress ?? `${presentVerbOf(operation.kind)}…`}
    </Span>
  </RowNote>
);

const ErrorNote = observer(({ profile }: { readonly profile: string }) => {
  const actions = useInject(profileActionsInjectable)();
  const error = actions.lastErrorOf(profile);

  return error ? (
    <RowNote>
      <ErrorOutlineIcon $size="s" $color="critical" />
      <Span $color="critical" $font={{ size: "s" }} $flexChild="shrinkable">
        {error}
      </Span>
      <PlainButton $tooltip="Dismiss" onClick={() => actions.dismissError(profile)}>
        <CloseIcon $size="s" />
      </PlainButton>
    </RowNote>
  ) : null;
});

const ProfileActions = observer(({ profile }: { readonly profile: ColimaProfile }) => {
  const actions = useInject(profileActionsInjectable)();
  const name = profile.name;
  const operation = actions.operationOf(name);

  return (
    <Div $flex={{ gap: "s", verticalAlign: "center", horizontalAlign: "right" }} $flexChild="fixed" $style={actionsWidth}>
      {actions.canOpenCluster(name) && (
        <PrimaryButton
          $disabled={actions.isOpeningCluster(name)}
          $tooltip={`Open ${actions.clusterOf(name)?.name.get() ?? contextNameOf(name)} in Lens`}
          onClick={() => actions.openCluster(name)}
        >
          {actions.isOpeningCluster(name) ? "Opening…" : "Open cluster"}
        </PrimaryButton>
      )}

      {operation ? null : profile.status === "Running" ? (
        <SecondaryButton onClick={() => actions.stop(name)}>
          <IconLabel Icon={StopIcon}>Stop</IconLabel>
        </SecondaryButton>
      ) : (
        <SecondaryButton onClick={() => actions.start(name)}>
          <IconLabel Icon={PlayArrowIcon}>Start</IconLabel>
        </SecondaryButton>
      )}

      <PlainButton
        $disabled={!actions.canOpenShell(name)}
        $tooltip={actions.canOpenShell(name) ? "Open a shell in the VM" : "Start the profile to open a shell in it"}
        onClick={() => actions.openShell(name)}
      >
        <TerminalIcon $size="m" />
      </PlainButton>

      <PlainButton
        $disabled={!actions.canDelete(name)}
        $tooltip="Delete the profile and its VM"
        onClick={() => void actions.delete(name)}
      >
        <DeleteIcon $size="m" />
      </PlainButton>
    </Div>
  );
});

const StatusIconCell = ({ children }: { readonly children: ReactNode }) => (
  <Span $flexChild="fixed" $style={statusIconWidth} $flex={{ horizontalAlign: "center", verticalAlign: "center" }}>
    {children}
  </Span>
);

const ProfileRow = observer(({ profile }: { readonly profile: ColimaProfile }) => {
  const actions = useInject(profileActionsInjectable)();
  const operation = actions.operationOf(profile.name);

  return (
    <Div $flex={{ direction: "vertical", gap: "xs" }} $padding={{ vertical: "s" }} $border={rowBorder}>
      <Div $flex={{ direction: "horizontal", verticalAlign: "center" }}>
        <StatusIconCell>
          <StatusIcon status={profile.status} operation={operation} />
        </StatusIconCell>
        <Cell share={columns.name} color="grey10">
          {profile.name}
        </Cell>
        <Cell share={columns.status} color={operation ? "primary" : statusColorOf(profile.status)}>
          {operation ? `${presentVerbOf(operation.kind)}…` : profile.status}
        </Cell>
        <Cell share={columns.cluster} color={profile.kubernetes ? "grey20" : "grey25"}>
          {profile.kubernetes ? contextNameOf(profile.name) : "No Kubernetes"}
        </Cell>
        <Cell share={columns.runtime}>{profile.runtime ?? "—"}</Cell>
        <Cell share={columns.cpus}>{profile.cpus ?? "—"}</Cell>
        <Cell share={columns.memory}>{formatBytes(profile.memory) ?? "—"}</Cell>
        <Cell share={columns.disk}>{formatBytes(profile.disk) ?? "—"}</Cell>
        <ProfileActions profile={profile} />
      </Div>

      {operation && <ProgressNote operation={operation} />}
      <ErrorNote profile={profile.name} />
    </Div>
  );
});

const CreatingRow = ({ name, operation }: { readonly name: string; readonly operation: Operation }) => (
  <Div $flex={{ direction: "vertical", gap: "xs" }} $padding={{ vertical: "s" }} $border={rowBorder}>
    <Div $flex={{ direction: "horizontal", verticalAlign: "center" }}>
      <StatusIconCell>
        <StatusIcon operation={operation} />
      </StatusIconCell>
      <Cell share={columns.name} color="grey10">
        {name}
      </Cell>
      <Cell share={columns.status} color="primary">
        Creating…
      </Cell>
      <Cell share={columns.cluster}>{contextNameOf(name)}</Cell>
      <Cell share={columns.runtime}>—</Cell>
      <Cell share={columns.cpus}>—</Cell>
      <Cell share={columns.memory}>—</Cell>
      <Cell share={columns.disk}>—</Cell>
      <Span $flexChild="fixed" $style={actionsWidth} />
    </Div>
    <ProgressNote operation={operation} />
  </Div>
);

const ProfilesCard = observer(() => {
  const profiles = useInject(colimaProfilesInjectable)();
  const operations = useInject(colimaOperationsInjectable)();
  const createProfile = useInject(createProfileInjectable)();
  const all = profiles.all.get();
  const creating = operations.creating.get();
  const listError = profiles.listError.get();

  if (all === undefined) {
    return (
      <Card>
        <CardTitle>Profiles</CardTitle>
        <Div $flex={{ gap: "s", verticalAlign: "center" }} $color="grey25">
          <SpinnerIcon $size="s" />
          Asking colima for its profiles…
        </Div>
      </Card>
    );
  }

  const count = all.length + creating.length;

  return (
    <Card>
      <CardTitle>{count > 0 ? `Profiles (${count})` : "Profiles"}</CardTitle>

      {listError && (
        <Div $flex={{ gap: "xs", verticalAlign: "center" }}>
          <ErrorOutlineIcon $size="s" $color="critical" />
          <Span $color="critical">colima list failed: {listError}</Span>
        </Div>
      )}

      {count === 0 ? (
        <Div $flex={{ direction: "vertical", gap: "m" }}>
          <Span $color="grey25">No profiles yet. Create one to get a local Kubernetes cluster that Lens can open.</Span>
          <Div $flex>
            <PrimaryButton onClick={() => void createProfile()}>New profile</PrimaryButton>
          </Div>
        </Div>
      ) : (
        <Div $flex={{ direction: "vertical" }}>
          <TableHeader />
          {creating.map(({ name, operation }) => (
            <CreatingRow key={name} name={name} operation={operation} />
          ))}
          {all.map((profile) => (
            <ProfileRow key={profile.name} profile={profile} />
          ))}
        </Div>
      )}
    </Card>
  );
});

const MissingColima = observer(({ message }: { readonly message: string }) => {
  const profiles = useInject(colimaProfilesInjectable)();
  const openLinkInBrowser = useInject(openLinkInBrowserInjectionToken)();

  return (
    <Card>
      <CardTitle icon={<ColimaIcon $size="m" />}>Colima is not installed, or Lens cannot find it</CardTitle>
      <Span $color="grey20">
        Colima runs Kubernetes clusters in lightweight virtual machines on your machine. Install it, then check again.
        With Homebrew:
      </Span>
      <Code>brew install colima</Code>
      <Span $color="grey25" $font={{ size: "s" }}>
        {message}
      </Span>
      <Div $flex={{ gap: "s" }}>
        <PrimaryButton onClick={() => void profiles.checkAgain()}>Check again</PrimaryButton>
        <SecondaryButton onClick={() => void openLinkInBrowser(installationGuideUrl)}>
          <IconLabel Icon={OpenInBrowserIcon}>Installation guide</IconLabel>
        </SecondaryButton>
      </Div>
    </Card>
  );
});

export const ColimaPage = observer(() => {
  const profiles = useInject(colimaProfilesInjectable)();
  const availability = profiles.availability.get();

  return (
    // The page a shade darker than its strip and cards, as Lens's dashboards are, so the cards stand out.
    <Div $height="full" $flex={{ direction: "vertical" }} $backgroundColor="backgroundSecondary">
      <SummaryStrip />

      <Div $flexChild="shrinkable" $overflow={{ y: "auto" }}>
        <Div $flex={{ direction: "vertical", gap: "l" }} $padding="xl">
          {availability.status === "checking" && (
            <Div $flex={{ gap: "s", verticalAlign: "center" }} $color="grey25">
              <SpinnerIcon $size="s" />
              Looking for colima…
            </Div>
          )}

          {availability.status === "missing" && <MissingColima message={availability.message} />}

          {availability.status === "available" && (
            <>
              <SummaryCards />
              <ProfilesCard />
            </>
          )}
        </Div>
      </Div>
    </Div>
  );
});
