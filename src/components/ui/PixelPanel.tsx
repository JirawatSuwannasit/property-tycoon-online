import type { HTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type PixelPanelTone = "paper" | "mint" | "sky" | "lavender";

type PixelPanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    tone?: PixelPanelTone;
  }
>;

const toneClasses: Record<PixelPanelTone, string> = {
  paper: "bg-[#fff7df]",
  mint: "bg-[#b8f2d0]",
  sky: "bg-[#a0d8ff]",
  lavender: "bg-[#cdb4db]",
};

export function PixelPanel({ children, className, tone = "paper", ...props }: PixelPanelProps) {
  return (
    <div className={clsx("pixel-border-lg", toneClasses[tone], className)} {...props}>
      {children}
    </div>
  );
}
