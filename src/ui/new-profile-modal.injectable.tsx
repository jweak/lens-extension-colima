import { Div, Form, Span } from "@k8slens/element-components";
import { PlayArrowIcon } from "@k8slens/icon";
import { getInjectable2 } from "@k8slens/injectable";
import { PlainButton, PrimaryButton } from "@k8slens/input-components";
import { ModalContainer, ModalContent, ModalFooter, ModalHeader } from "@k8slens/modal-components";
import {
  getModalInjectableBunch,
  getModalKind,
  type ModalProps,
  openModalInjectionToken,
  useRespondFromModal,
} from "@k8slens/modal-contracts";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import type { ReactNode } from "react";
import { colimaOperationsInjectable, type ContainerRuntime, type NewProfile } from "../colima/colima-operations.injectable";
import { contextNameOf } from "../colima/shell";
import { ColimaIcon } from "./colima-icon";
import { IconLabel } from "./components/buttons";
import { CheckboxField, CompactTextInput, RadioGroup, type RadioOption } from "./components/choice-controls";
import { type NewProfileField, type NewProfileForm, newProfileFormInjectable } from "./new-profile-form.injectable";

/** Asks what the new profile is to be; answers undefined when the user thinks better of it. */
export const newProfileModalKind = getModalKind<[], NewProfile | undefined>()("new-profile");

const Field = ({ label, error, grow, children }: {
  readonly label: string;
  readonly error?: string;
  /** Take the room the row's other fields leave; otherwise as wide as what is in it. */
  readonly grow?: boolean;
  readonly children: ReactNode;
}) => (
  <Div $flex={{ direction: "vertical", gap: "s" }} $flexChild={grow ? "shrinkable" : "fixed"}>
    {/* Labelled the way the preferences label their settings. */}
    <Span $font={{ bold: "600", uppercase: true, noWrap: true }} $color="textHighlight">
      {label}
    </Span>
    {children}
    {error && (
      <Span $font={{ size: "s" }} $color="critical">
        {error}
      </Span>
    )}
  </Div>
);

const FormTextField = observer(
  ({ form, field, label, placeholder, autoFocus, grow, width, unit, disabled }: {
    readonly form: NewProfileForm;
    readonly field: NewProfileField;
    readonly label: string;
    readonly placeholder?: string;
    readonly autoFocus?: boolean;
    readonly grow?: boolean;
    /** For a value of a known length, a number or a version: as wide as that, rather than the row. */
    readonly width?: string;
    /** What the number is counted in, after the box. */
    readonly unit?: string;
    readonly disabled?: boolean;
  }) => (
    <Field label={label} error={disabled ? undefined : form.errorOf(field)} grow={grow}>
      <Div $flex={{ direction: "horizontal", gap: "xs", verticalAlign: "center" }}>
        <CompactTextInput
          value={form.valueOf(field)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          $disabled={disabled}
          {...(disabled ? { $color: "textMuted" as const } : {})}
          $style={width ? { width } : undefined}
          onChange={(event) => form.set(field, event.target.value)}
        />
        {unit && (
          <Span $color="textDefault" $font={{ size: "s" }}>
            {unit}
          </Span>
        )}
      </Div>
    </Field>
  ),
);

// Room for what each field holds: up to four digits, and a k3s release such as v1.35.0+k3s1.
const numberWidth = "calc(var(--unit) * 12)";
const versionWidth = "calc(var(--unit) * 28)";

const runtimeOptions: readonly RadioOption<ContainerRuntime>[] = [
  { id: "docker", label: "Docker", description: "The Docker engine, with a docker context for the profile" },
  { id: "containerd", label: "containerd", description: "containerd and nerdctl, without Docker" },
];

const NewProfileModal = observer((_props: ModalProps<typeof newProfileModalKind>) => {
  const respond = useRespondFromModal(newProfileModalKind);
  const form = useInject(newProfileFormInjectable)();
  const name = form.valueOf("name").trim();

  const submit = () => {
    const profile = form.toNewProfile();

    if (profile) {
      respond(profile);
    }
  };

  return (
    <ModalContainer $style={{ width: "calc(var(--unit) * 100)" }}>
      {/* A form, so that Enter in any of its fields creates the profile. */}
      <Form
        $displayContents
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ModalHeader icon={<ColimaIcon />}>New Colima profile</ModalHeader>

        <ModalContent>
          <Div $flex={{ direction: "vertical", gap: "l" }}>
            <Div $flex={{ gap: "m" }}>
              <FormTextField form={form} field="name" label="Name" autoFocus grow />
              <FormTextField
                form={form}
                field="kubernetesVersion"
                label="Kubernetes"
                placeholder="default"
                width={versionWidth}
                disabled={!form.kubernetes.get()}
              />
            </Div>

            <Div $flex={{ gap: "xl" }}>
              <FormTextField form={form} field="cpus" label="CPUs" width={numberWidth} />
              <FormTextField form={form} field="memoryGib" label="Memory" width={numberWidth} unit="GiB" />
              <FormTextField form={form} field="diskGib" label="Disk" width={numberWidth} unit="GiB" />
            </Div>

            <Field label="Container runtime">
              <RadioGroup
                aria-label="Container runtime"
                options={runtimeOptions}
                selected={form.runtime.get()}
                onSelect={form.setRuntime}
              />
            </Field>

            <Field label="Cluster">
              <CheckboxField
                checked={form.kubernetes.get()}
                onToggle={form.toggleKubernetes}
                label="Kubernetes (k3s)"
                description={
                  form.kubernetes.get()
                    ? `Starts k3s in the VM, which takes a few minutes. Lens picks the cluster up as ${contextNameOf(name || "…")}.`
                    : "Without it, the VM runs the container runtime only."
                }
              />
            </Field>
          </Div>
        </ModalContent>

        <ModalFooter>
          <PlainButton onClick={() => respond(undefined)}>Cancel</PlainButton>
          <PrimaryButton type="submit" $disabled={!form.isValid.get()}>
            <IconLabel Icon={PlayArrowIcon}>Create and start</IconLabel>
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalContainer>
  );
});

export const newProfileModal = getModalInjectableBunch({
  kind: newProfileModalKind,
  Component: NewProfileModal,
  onClose: () => undefined,
});

/** Asks for a new profile in the modal, and creates and starts it when the user says so. */
export const createProfileInjectable = getInjectable2({
  id: "colima-create-profile",
  consumptions: [openModalInjectionToken],

  instantiate: (di) => {
    const openNewProfileModal = di.inject(openModalInjectionToken.for(newProfileModalKind).for(di.scopeIds))();
    const form = di.inject(newProfileFormInjectable)();
    const operations = di.inject(colimaOperationsInjectable)();
    let isAsking = false;

    return () => async () => {
      // A second click while the modal is up would stack another one on top.
      if (isAsking) {
        return false;
      }

      isAsking = true;
      form.prepare();

      try {
        const profile = await openNewProfileModal();

        if (!profile) {
          return false;
        }

        void operations.create(profile);

        return true;
      } finally {
        isAsking = false;
      }
    };
  },
});
