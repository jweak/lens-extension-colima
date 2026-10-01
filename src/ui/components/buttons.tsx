import { Span, type SvgProps } from "@k8slens/element-components";
import { PlainButton, type PlainButtonProps } from "@k8slens/input-components";
import type { ComponentType, ReactNode } from "react";

/**
 * An icon and its label, close together. The buttons of `@k8slens/input-components` leave a wide
 * gap after an `Icon` handed to them, so buttons here take this as their children instead.
 */
export const IconLabel = ({ Icon, children }: { readonly Icon: ComponentType<SvgProps>; readonly children: ReactNode }) => (
  <Span $flex={{ direction: "horizontal", gap: "xxs", verticalAlign: "center" }}>
    <Icon $size="s" />
    <Span>{children}</Span>
  </Span>
);

/** The grey, filled button Lens's dashboards put beside their primary action: Sync, Refresh. */
export const SecondaryButton = (props: PlainButtonProps) => (
  <PlainButton
    $backgroundColor={{ normal: "grey60", hover: "grey40" }}
    $color="textHighlight"
    $padding={{ vertical: "xs", horizontal: "s" }}
    {...props}
  />
);
