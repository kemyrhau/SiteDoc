import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = "", id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary disabled:cursor-not-allowed disabled:bg-gray-50 ${error ? "border-siteflow-error focus:border-siteflow-error focus:ring-siteflow-error" : ""} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-siteflow-error">{error}</p>}
      </div>
    );
  },
);
