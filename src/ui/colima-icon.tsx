import { Svg, type SvgProps } from "@k8slens/element-components";

/**
 * A virtual machine as a box, the one shape colima is about, drawn in the colour of what holds it.
 * Sized like Lens's own glyphs unless told otherwise: an Svg left unsized fills whatever holds it.
 */
export const ColimaIcon = ({ $size = "l", ...props }: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinejoin="round"
    $size={$size}
    {...props}
  >
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
    <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
  </Svg>
);
