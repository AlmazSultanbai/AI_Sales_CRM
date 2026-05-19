import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[96px] w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
