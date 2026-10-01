import { ClickableDiv, type ClickableDivProps, Div, Span, Svg } from "@k8slens/element-components";
import { CheckIcon } from "@k8slens/icon";
import { TextInput, type TextInputProps } from "@k8slens/input-components";
import type { ReactNode } from "react";

/*
 * The radio buttons, checkbox and compact text box Lens's own dialogs are drawn with. Lens does not
 * publish those to extensions, so these draw the same thing out of the element components it does.
 */

const checkSize = { min: "s", size: "s" } as const;
const radioSize = "l";

/** The box of Lens's checkbox: a thin rounded square, the tick in the primary colour when checked. */
const CheckboxBox = ({ checked }: { readonly checked: boolean }) => (
  <Div
    $size={checkSize}
    $flexChild="fixed"
    $flex={{ direction: "horizontal", horizontalAlign: "center", verticalAlign: "center" }}
    $border={{ radius: "s", width: "xxs", color: "grey20" }}
    $color={checked ? "primary" : "transparent"}
  >
    <CheckIcon $size={checkSize} />
  </Div>
);

/** The mark of Lens's radio button: a ring, and a dot in it in the primary colour when chosen. */
const RadioMark = ({ checked }: { readonly checked: boolean }) => (
  <Svg viewBox="0 0 24 24" fill="none" $size={radioSize} $flexChild="fixed" $color={checked ? "primary" : "textMuted"}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} />
    {checked && <circle cx="12" cy="12" r="5" fill="currentColor" />}
  </Svg>
);

/**
 * The mark beside its label, centred on the label's line however tall the mark is, and what the
 * option means beneath the label, indented by room as big as the mark so the two start together.
 */
const OptionLines = ({ mark, markRoom, label, description }: {
  readonly mark: ReactNode;
  readonly markRoom: ReactNode;
  readonly label: ReactNode;
  readonly description?: ReactNode;
}) => (
  <>
    <Div $flex={{ direction: "horizontal", gap: "s", verticalAlign: "center" }}>
      {mark}
      <Span $color="textHighlight">{label}</Span>
    </Div>
    {description && (
      <Div $flex={{ direction: "horizontal", gap: "s" }}>
        {markRoom}
        <Span $color="textDefault" $font={{ size: "s" }} $flexChild="shrinkable">
          {description}
        </Span>
      </Div>
    )}
  </>
);

interface CheckboxFieldProps extends Omit<ClickableDivProps, "children" | "role" | "aria-checked"> {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: ReactNode;
  readonly description?: ReactNode;
}

/** A checkbox with its label, the whole row being the control: clicking the label toggles it too. */
export const CheckboxField = ({ checked, onToggle, label, description, ...rest }: CheckboxFieldProps) => (
  <ClickableDiv
    role="checkbox"
    aria-checked={checked}
    $flex={{ direction: "vertical", gap: "xxs" }}
    $onClick={onToggle}
    {...rest}
  >
    <OptionLines
      mark={<CheckboxBox checked={checked} />}
      markRoom={<Div $size={checkSize} $flexChild="fixed" />}
      label={label}
      description={description}
    />
  </ClickableDiv>
);

export interface RadioOption<Id extends string> {
  readonly id: Id;
  readonly label: ReactNode;
  readonly description?: ReactNode;
}

interface RadioGroupProps<Id extends string> {
  readonly options: readonly RadioOption<Id>[];
  readonly selected: Id | undefined;
  readonly onSelect: (id: Id) => void;
  readonly "aria-label"?: string;
}

/** One option of several, each a row with its ring, its label and what it means beneath. */
export const RadioGroup = <Id extends string>({ options, selected, onSelect, ...rest }: RadioGroupProps<Id>) => (
  <Div role="radiogroup" $flex={{ direction: "vertical", gap: "s" }} {...rest}>
    {options.map((option) => {
      const checked = option.id === selected;

      return (
        <ClickableDiv
          key={option.id}
          role="radio"
          aria-checked={checked}
          $flex={{ direction: "vertical", gap: "xxs" }}
          $onClick={() => onSelect(option.id)}
        >
          <OptionLines
            mark={<RadioMark checked={checked} />}
            markRoom={<Div $size={radioSize} $flexChild="fixed" />}
            label={option.label}
            description={option.description}
          />
        </ClickableDiv>
      );
    })}
  </Div>
);

/** Lens's text box, as low as its buttons, for forms with several fields to a row. */
export const CompactTextInput = (props: TextInputProps) => (
  <TextInput $padding={{ vertical: "xxs", horizontal: "xs" }} $font={{ size: "s" }} {...props} />
);
