"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Unplug,
  Mail,
  Sparkles,
  Sliders,
  FileSignature,
  Shield,
  Zap,
  Bot,
  MessageSquare,
} from "lucide-react";
import { settingsApi, gmailApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const approvalModes = [
  {
    id: "draft_approval",
    name: "Draft for Approval",
    description: "Agent creates drafts that require your approval before sending",
    icon: Shield,
  },
  {
    id: "auto_with_rules",
    name: "Auto-send with Rules",
    description: "Automatically sends for matching rules, drafts for others",
    icon: Zap,
  },
  {
    id: "fully_automatic",
    name: "Fully Automatic",
    description: "Agent automatically responds to all emails (use with caution)",
    icon: Bot,
  },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: () => settingsApi.getModels(),
  });

  const { data: gmailStatus, refetch: refetchGmail } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => gmailApi.getStatus(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSuccessMessage("Settings saved");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  useEffect(() => {
    if (searchParams.get("gmail") === "connected") {
      refetchGmail();
      setSuccessMessage("Gmail connected successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, [searchParams, refetchGmail]);

  const handleConnectGmail = async () => {
    const res = await gmailApi.getAuthUrl();
    window.location.href = res.data.auth_url;
  };

  const handleDisconnectGmail = async () => {
    if (confirm("Disconnect Gmail? The agent will stop processing emails.")) {
      await gmailApi.disconnect();
      refetchGmail();
    }
  };

  const currentSettings = settings?.data;
  const availableModels = models?.data || [];
  const gmail = gmailStatus?.data;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your email agent preferences
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-success/10 text-success rounded-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Gmail Connection */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Gmail Connection</h2>
        </div>
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          {gmail?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="font-medium">Connected</p>
                  <p className="text-sm text-muted-foreground">{gmail.email}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectGmail}
                className="flex items-center gap-2 px-4 py-2.5 text-destructive border border-destructive/30 rounded-xl font-medium transition-soft hover:bg-destructive/10"
              >
                <Unplug className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="font-medium">Not connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Gmail to get started
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectGmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90"
              >
                Connect Gmail
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Approval Mode */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Approval Mode</h2>
        </div>
        <div className="space-y-3">
          {approvalModes.map((mode) => {
            const isSelected = currentSettings?.approval_mode === mode.id;
            const Icon = mode.icon;

            return (
              <label
                key={mode.id}
                className={cn(
                  "flex items-start gap-4 p-4 bg-card rounded-2xl border cursor-pointer transition-soft",
                  isSelected
                    ? "border-primary shadow-warm bg-primary/[0.02]"
                    : "border-border hover:border-primary/30 hover:bg-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="approval_mode"
                  value={mode.id}
                  checked={isSelected}
                  onChange={() => updateMutation.mutate({ approval_mode: mode.id })}
                  className="sr-only"
                />
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-soft",
                    isSelected ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{mode.name}</p>
                    {isSelected && (
                      <span className="badge badge-approved">Active</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {mode.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* AI Model */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">AI Model</h2>
        </div>
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <select
            value={currentSettings?.llm_model || ""}
            onChange={(e) => updateMutation.mutate({ llm_model: e.target.value })}
            className="w-full p-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft"
          >
            {availableModels.map((model: any) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Temperature */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            Creativity Level
          </h2>
        </div>
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Temperature</span>
            <span className="font-mono text-sm font-medium bg-accent px-2 py-1 rounded-lg">
              {currentSettings?.llm_temperature || 0.7}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={currentSettings?.llm_temperature || 0.7}
            onChange={(e) =>
              updateMutation.mutate({ llm_temperature: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-accent rounded-full appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Precise & Focused</span>
            <span>Creative & Varied</span>
          </div>
        </div>
      </section>

      {/* System Prompt */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">AI Instructions</h2>
        </div>
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <textarea
            value={currentSettings?.system_prompt || ""}
            onChange={(e) => updateMutation.mutate({ system_prompt: e.target.value })}
            placeholder="Custom instructions for the AI when drafting responses...

Example: Always be concise and professional. Sign off with just my first name. Never use exclamation marks."
            rows={6}
            className="w-full p-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft resize-none font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            These instructions guide how the AI writes email responses. Be specific about tone, style, and any rules to follow.
          </p>
        </div>
      </section>

      {/* Signature */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Email Signature</h2>
        </div>
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <textarea
            value={currentSettings?.signature || ""}
            onChange={(e) => updateMutation.mutate({ signature: e.target.value })}
            placeholder="Enter your email signature..."
            rows={4}
            className="w-full p-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This signature will be appended to all AI-generated emails
          </p>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p>Loading settings...</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
