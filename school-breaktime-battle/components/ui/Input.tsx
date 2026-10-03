import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "min-h-12 w-full rounded-2xl border-2 bg-white px-4 text-lg text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-sun/50";

type FieldProps = { label: string; error?: string | null; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-base font-bold text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(fieldClass, error ? "border-danger" : "border-brand/20", className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Select({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-base font-bold text-ink">
        {label}
      </label>
      <select id={selectId} className={cn(fieldClass, "border-brand/20 pr-8", className)} {...props}>
        {children}
      </select>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink/60">{hint}</p>
      ) : null}
    </div>
  );
}
