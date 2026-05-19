import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-sm hover:bg-[#365684]",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        outline: "border border-border bg-white text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-slate-50",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
