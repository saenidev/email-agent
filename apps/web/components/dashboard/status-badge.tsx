import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type DraftStatus = "pending" | "approved" | "sent" | "auto_sent" | "rejected";

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: DraftStatus;
}

const statusConfig: Record<DraftStatus, { variant: BadgeProps["variant"]; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "default", label: "Approved" },
  sent: { variant: "success", label: "Sent" },
  auto_sent: { variant: "success", label: "Auto-sent" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className={className} {...props}>
      {config.label}
    </Badge>
  );
}
