import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-400 focus:shadow-[0_0_0_3px_rgba(42,67,104,0.12)]",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
