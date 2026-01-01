import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-2",
};

export function LoadingSpinner({
  className,
  size = "md",
  label,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div
        className={cn(
          "border-primary/30 border-t-primary rounded-full animate-spin",
          sizeClasses[size]
        )}
      />
      {label && (
        <p className="text-muted-foreground text-sm mt-2">{label}</p>
      )}
    </div>
  );
}
