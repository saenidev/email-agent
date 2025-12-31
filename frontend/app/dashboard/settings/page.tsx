"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Unplug } from "lucide-react";
import { settingsApi, gmailApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const approvalModes = [
  {
    id: "draft_approval",
    name: "Draft for Approval",
    description: "Agent creates drafts that require your approval before sending",
  },
  {
    id: "auto_with_rules",
    name: "Auto-send with Rules",
    description: "Automatically sends for matching rules, drafts for others",
  },
  {
    id: "fully_automatic",
    name: "Fully Automatic",
    description: "Agent automatically responds to all emails (use with caution)",
  },
];

export default function SettingsPage() {
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-500/10 text-green-600 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Gmail Connection */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Gmail Connection</h2>
        {gmail?.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Connected</p>
                <p className="text-sm text-muted-foreground">{gmail.email}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnectGmail}
              className="flex items-center gap-2 px-3 py-2 text-destructive border border-destructive rounded-md hover:bg-destructive/10"
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <p>Not connected</p>
            </div>
            <button
              onClick={handleConnectGmail}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Connect Gmail
            </button>
          </div>
        )}
      </section>

      {/* Approval Mode */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Approval Mode</h2>
        <div className="space-y-2">
          {approvalModes.map((mode) => (
            <label
              key={mode.id}
              className={cn(
                "flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent",
                currentSettings?.approval_mode === mode.id && "border-primary bg-primary/5"
              )}
            >
              <input
                type="radio"
                name="approval_mode"
                value={mode.id}
                checked={currentSettings?.approval_mode === mode.id}
                onChange={() => updateMutation.mutate({ approval_mode: mode.id })}
                className="mt-1"
              />
              <div>
                <p className="font-medium">{mode.name}</p>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* LLM Model */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">AI Model</h2>
        <select
          value={currentSettings?.llm_model || ""}
          onChange={(e) => updateMutation.mutate({ llm_model: e.target.value })}
          className="w-full p-2 border rounded-md bg-background"
        >
          {availableModels.map((model: any) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </section>

      {/* Temperature */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Temperature: {currentSettings?.llm_temperature || 0.7}
        </h2>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={currentSettings?.llm_temperature || 0.7}
          onChange={(e) =>
            updateMutation.mutate({ llm_temperature: parseFloat(e.target.value) })
          }
          className="w-full"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </section>

      {/* Signature */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Email Signature</h2>
        <textarea
          value={currentSettings?.signature || ""}
          onChange={(e) => updateMutation.mutate({ signature: e.target.value })}
          placeholder="Your email signature..."
          rows={3}
          className="w-full p-2 border rounded-md bg-background"
        />
      </section>
    </div>
  );
}
