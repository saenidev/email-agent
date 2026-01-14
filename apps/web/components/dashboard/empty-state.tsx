import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center animate-fade-in",
        className
      )}
    >
      {/* Layered icon container with subtle depth */}
      <div className="relative mb-6">
        {/* Outer glow ring */}
        <div className="absolute inset-0 h-16 w-16 rounded-2xl bg-primary/5 blur-xl" />
        {/* Icon container with gradient border effect */}
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-soft border border-border/50">
          <Icon className="h-7 w-7 text-muted-foreground/70" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground/90">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
