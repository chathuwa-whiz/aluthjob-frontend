import type { ComponentProps, ReactNode } from "react";
import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/** Class names for anything that should look like a button, such as a router link. */
export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", block = false) =>
  cx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block");

type Props = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks further clicks while a request is running. */
  busy?: boolean;
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", busy, block, icon, className, children, disabled, type = "button", ...rest }: Props) {
  return (
    <button type={type} className={cx(buttonClass(variant, size, block), className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
