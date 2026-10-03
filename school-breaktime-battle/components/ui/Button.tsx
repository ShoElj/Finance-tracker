import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_4px_0_0_var(--color-brand-dark)] hover:bg-brand-light",
  secondary: "bg-sun text-ink shadow-[0_4px_0_0_var(--color-sun-dark)] hover:brightness-105",
  danger: "bg-danger text-white shadow-[0_4px_0_0_var(--color-danger-dark)] hover:brightness-110",
  ghost: "bg-white/70 text-brand ring-2 ring-brand/20 hover:bg-white",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3 text-sm rounded-xl",
  md: "min-h-12 px-5 text-base rounded-2xl",
  lg: "min-h-14 px-7 text-lg rounded-2xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition active:translate-y-[2px] active:shadow-none",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/70",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
});
