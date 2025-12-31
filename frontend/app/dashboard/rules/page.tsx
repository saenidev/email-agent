"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Filter, Trash2, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { rulesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const actionLabels: Record<string, string> = {
  auto_respond: "Auto Respond",
  draft_only: "Draft Only",
  ignore: "Ignore",
  forward: "Forward",
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Automation Rules</h1>
        <Link
          href="/dashboard/rules/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No rules yet</p>
          <p className="text-sm">
            Create rules to automate how the agent handles emails
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {rules.map((rule: any) => (
            <div
              key={rule.id}
              className={cn("p-4", !rule.is_active && "opacity-60")}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{rule.name}</h3>
                    <span className="px-2 py-0.5 text-xs bg-secondary rounded">
                      {actionLabels[rule.action] || rule.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Priority: {rule.priority}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {rule.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate(rule.id)}
                    className={cn(
                      "p-2 rounded-md",
                      rule.is_active
                        ? "text-green-600 hover:bg-green-50"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                    title={rule.is_active ? "Disable" : "Enable"}
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
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
