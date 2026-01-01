"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Filter, Trash2, Power, PowerOff, Zap, Forward, Mail, Ban } from "lucide-react";
import Link from "next/link";
import { rulesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const actionConfig: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  auto_respond: {
    label: "Auto Respond",
    icon: Zap,
    color: "bg-success/10 text-success",
  },
  draft_only: {
    label: "Draft Only",
    icon: Mail,
    color: "bg-primary/10 text-primary",
  },
  ignore: {
    label: "Ignore",
    icon: Ban,
    color: "bg-muted text-muted-foreground",
  },
  forward: {
    label: "Forward",
    icon: Forward,
    color: "bg-warning/10 text-warning",
  },
};

export default function RulesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: () => rulesApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => rulesApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });

  const rules = data?.data || [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Automation Rules"
        description="Configure how the agent handles different emails"
        actions={
          <Button asChild size="sm" className="gap-2">
            <Link href="/dashboard/rules/new">
              <Plus className="h-4 w-4" />
              New Rule
            </Link>
          </Button>
        }
      />

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-16" label="Loading rules..." />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No rules yet"
          description="Create rules to automate how the agent handles different types of emails"
          action={
            <Button asChild className="gap-2">
              <Link href="/dashboard/rules/new">
                <Plus className="h-4 w-4" />
                Create Your First Rule
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => {
            const action = actionConfig[rule.action] || actionConfig.draft_only;
            const ActionIcon = action.icon;

            return (
              <Card
                key={rule.id}
                className={cn(
                  "p-4 transition-opacity",
                  !rule.is_active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        action.color
                      )}
                    >
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-medium text-sm">{rule.name}</h3>
                        <Badge variant="secondary">{action.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Priority {rule.priority}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMutation.mutate(rule.id)}
                      disabled={toggleMutation.isPending}
                      className={cn(
                        "h-8 w-8",
                        rule.is_active
                          ? "text-success hover:text-success hover:bg-success/10"
                          : "text-muted-foreground"
                      )}
                      title={rule.is_active ? "Disable rule" : "Enable rule"}
                    >
                      {rule.is_active ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this rule?")) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
