"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Mail,
  FileEdit,
  Send,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Link2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { activityApi } from "@/lib/api";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/dashboard";
import { Card } from "@/components/ui/card";

const activityConfig: Record<
  string,
  { icon: typeof Mail; color: string; label: string }
> = {
  email_received: {
    icon: Mail,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "Email Received",
  },
  draft_created: {
    icon: FileEdit,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Draft Created",
  },
  draft_approved: {
    icon: CheckCircle2,
    color: "bg-success/10 text-success",
    label: "Draft Approved",
  },
  draft_rejected: {
    icon: XCircle,
    color: "bg-destructive/10 text-destructive",
    label: "Draft Rejected",
  },
  email_sent: {
    icon: Send,
    color: "bg-success/10 text-success",
    label: "Email Sent",
  },
  rule_matched: {
    icon: Filter,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "Rule Matched",
  },
  gmail_connected: {
    icon: Link2,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "Gmail Connected",
  },
  settings_changed: {
    icon: Settings,
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    label: "Settings Changed",
  },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => activityApi.list(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activities = data?.data?.activities || [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Activity Log"
        description="Track what your email agent has been doing"
      />

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-16" label="Loading activity..." />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Activity from the email agent will appear here as it processes your emails"
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Timeline */}
          <div className="relative">
            {activities.map((activity: any, index: number) => {
              const config =
                activityConfig[activity.activity_type] ||
                activityConfig.email_received;
              const Icon = config.icon;
              const isLast = index === activities.length - 1;

              return (
                <div
                  key={activity.id}
                  className={cn(
                    "relative flex gap-3 p-3",
                    !isLast && "border-b border-border"
                  )}
                >
                  {/* Timeline connector */}
                  {!isLast && (
                    <div className="absolute left-[26px] top-[44px] bottom-0 w-px bg-border" />
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 relative z-10",
                      config.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          {config.label}
                        </p>
                        <p className="text-sm">{activity.description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(activity.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
