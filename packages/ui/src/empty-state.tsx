import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-12 text-center ${className}`}>
      <h3 className="mb-1 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-gray-500">{description}</p>
      )}
      {action}
    </div>
  );
}
