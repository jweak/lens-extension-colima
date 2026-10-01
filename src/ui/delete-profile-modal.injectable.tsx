import { Div, P, Span } from "@k8slens/element-components";
import { WarningIcon } from "@k8slens/icon";
import { DangerButton, PlainButton } from "@k8slens/input-components";
import { ModalContainer, ModalContent, ModalFooter, ModalHeader } from "@k8slens/modal-components";
import { getModalInjectableBunch, getModalKind, type ModalProps, useRespondFromModal } from "@k8slens/modal-contracts";
import { useState } from "react";
import { CheckboxField } from "./components/choice-controls";

export interface DeleteProfileAnswer {
  readonly deleteData: boolean;
}

/** Asks before a profile's VM is deleted; answers undefined when the user thinks better of it. */
export const deleteProfileModalKind = getModalKind<[profile: string], DeleteProfileAnswer | undefined>()(
  "delete-profile",
);

const DeleteProfileModal = ({ input: [profile] }: ModalProps<typeof deleteProfileModalKind>) => {
  const respond = useRespondFromModal(deleteProfileModalKind);
  const [deleteData, setDeleteData] = useState(false);

  return (
    <ModalContainer $style={{ width: "calc(var(--unit) * 120)" }}>
      <ModalHeader icon={<WarningIcon />}>Delete Colima profile</ModalHeader>

      <ModalContent>
        <Div $flex={{ direction: "vertical", gap: "m" }}>
          <P>
            Delete the profile <Span $font={{ bold: true }}>{profile}</Span> and its virtual machine? Its Kubernetes
            cluster goes with it. This cannot be undone.
          </P>

          <CheckboxField
            checked={deleteData}
            onToggle={() => setDeleteData(!deleteData)}
            label="Also delete container data"
            description="The profile's images, volumes and containers"
          />
        </Div>
      </ModalContent>

      <ModalFooter>
        <PlainButton onClick={() => respond(undefined)}>Cancel</PlainButton>
        <DangerButton onClick={() => respond({ deleteData })}>Delete</DangerButton>
      </ModalFooter>
    </ModalContainer>
  );
};

export const deleteProfileModal = getModalInjectableBunch({
  kind: deleteProfileModalKind,
  Component: DeleteProfileModal,
  onClose: () => undefined,
});
