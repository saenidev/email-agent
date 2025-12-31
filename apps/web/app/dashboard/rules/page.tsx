"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Filter, Trash2, Power, PowerOff, Zap, Forward, Mail, Ban } from "lucide-react";
import Link from "next/link";
import { rulesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Automation Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure how the agent handles different emails
          </p>
        </div>
        <Link
          href="/dashboard/rules/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p>Loading rules...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-medium mb-1">No rules yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            Create rules to automate how the agent handles different types of emails
          </p>
          <Link
            href="/dashboard/rules/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Your First Rule
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule: any, index: number) => {
            const action = actionConfig[rule.action] || actionConfig.draft_only;
            const ActionIcon = action.icon;

            return (
              <div
                key={rule.id}
                className={cn(
                  "bg-card rounded-2xl shadow-warm border border-border p-5 transition-soft",
                  !rule.is_active && "opacity-60"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                        action.color
                      )}
                    >
                      <ActionIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium">{rule.name}</h3>
                        <span className="badge bg-secondary text-secondary-foreground">
                          {action.label}
                        </span>
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
                    <button
                      onClick={() => toggleMutation.mutate(rule.id)}
                      disabled={toggleMutation.isPending}
                      className={cn(
                        "p-2.5 rounded-xl transition-soft",
                        rule.is_active
                          ? "text-success hover:bg-success/10"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                      title={rule.is_active ? "Disable rule" : "Enable rule"}
                    >
                      {rule.is_active ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this rule?")) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl transition-soft"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
