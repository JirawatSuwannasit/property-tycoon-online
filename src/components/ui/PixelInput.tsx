import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type PixelInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function PixelInput({ className, id, label, ...props }: PixelInputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#2b1f3a]">
        {label}
      </span>
      <input
        className={clsx(
          "w-full border-[3px] border-[#2b1f3a] bg-white px-4 py-3 text-[#2b1f3a] shadow-[4px_4px_0_#2b1f3a] outline-none",
          "placeholder:text-[#7b6b8d] focus:ring-4 focus:ring-[#ffd166]",
          className,
        )}
        id={inputId}
        {...props}
      />
    </label>
  );
}
