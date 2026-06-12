import type { HTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type PixelCardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    label?: string;
  }
>;

export function PixelCard({ children, className, label, ...props }: PixelCardProps) {
  return (
    <div
      className={clsx(
        "pixel-border relative overflow-hidden bg-[#fff2cc] p-5 text-[#2b1f3a]",
        "before:absolute before:right-3 before:top-3 before:h-3 before:w-3 before:bg-[#ff9aa2] before:shadow-[14px_0_0_#a0d8ff,28px_0_0_#b8f2d0]",
        className,
      )}
      {...props}
    >
      {label ? (
        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#6c557d]">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
