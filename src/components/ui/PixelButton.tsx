import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type PixelButtonVariant = "primary" | "secondary" | "accent";

type PixelButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: PixelButtonVariant;
  }
>;

const variantClasses: Record<PixelButtonVariant, string> = {
  primary: "bg-[#ffd166] text-[#2b1f3a]",
  secondary: "bg-[#b8f2d0] text-[#2b1f3a]",
  accent: "bg-[#ff9aa2] text-[#2b1f3a]",
};

export function PixelButton({
  children,
  className,
  disabled,
  type = "button",
  variant = "primary",
  ...props
}: PixelButtonProps) {
  return (
    <button
      className={clsx(
        "pixel-button-press pixel-border inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-[0.16em]",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a0d8ff]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
