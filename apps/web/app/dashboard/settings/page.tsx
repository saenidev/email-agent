"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
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
  ShieldAlert,
  XCircle,
  Plus,
  X,
  TestTube,
} from "lucide-react";
import { settingsApi, gmailApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader, LoadingSpinner } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

  // Local state for text inputs (debounced saving)
  const [systemPrompt, setSystemPrompt] = useState("");
  const [signature, setSignature] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>([]);
  const [testContent, setTestContent] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingGuardrails, setIsTestingGuardrails] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  // Sync local state when settings load
  useEffect(() => {
    if (settings?.data) {
      setSystemPrompt(settings.data.system_prompt || "");
      setSignature(settings.data.signature || "");
      setBlockedKeywords(settings.data.guardrail_blocked_keywords || []);
    }
  }, [settings?.data]);

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

  // Debounced save for text fields (waits 800ms after typing stops)
  const debouncedSave = useCallback(
    (field: string, value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        updateMutation.mutate({ [field]: value });
      }, 800);
    },
    [updateMutation]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !blockedKeywords.includes(trimmed)) {
      const updated = [...blockedKeywords, trimmed];
      setBlockedKeywords(updated);
      updateMutation.mutate({ guardrail_blocked_keywords: updated });
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    const updated = blockedKeywords.filter((k) => k !== keyword);
    setBlockedKeywords(updated);
    updateMutation.mutate({ guardrail_blocked_keywords: updated });
  };

  const handleTestGuardrails = async () => {
    if (!testContent.trim()) return;
    setIsTestingGuardrails(true);
    setTestResult(null);
    try {
      const result = await settingsApi.testGuardrails(testContent, 0.8);
      setTestResult(result.data);
    } catch {
      setTestResult({ error: "Failed to test guardrails" });
    } finally {
      setIsTestingGuardrails(false);
    }
  };

  const currentSettings = settings?.data;
  const availableModels = models?.data || [];
  const gmail = gmailStatus?.data;

  if (isLoading) {
    return <LoadingSpinner className="py-16" label="Loading settings..." />;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        description="Configure your email agent preferences"
      />

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 p-3 bg-success/10 text-success rounded-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Gmail Connection */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Gmail Connection</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            {gmail?.connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Connected</p>
                    <p className="text-xs text-muted-foreground">{gmail.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectGmail}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Not connected</p>
                    <p className="text-xs text-muted-foreground">
                      Connect your Gmail to get started
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleConnectGmail}>
                  Connect Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Approval Mode */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Approval Mode</h2>
        </div>
        <div className="space-y-2">
          {approvalModes.map((mode) => {
            const isSelected = currentSettings?.approval_mode === mode.id;
            const Icon = mode.icon;

            return (
              <label
                key={mode.id}
                className={cn(
                  "flex items-start gap-3 p-3 bg-card rounded-lg border cursor-pointer transition-colors",
                  isSelected
                    ? "border-primary bg-primary/[0.02]"
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
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{mode.name}</p>
                    {isSelected && <Badge variant="default">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mode.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* AI Model */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">AI Model</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <Select
              value={currentSettings?.llm_model || ""}
              onValueChange={(value) => updateMutation.mutate({ llm_model: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model: any) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </section>

      {/* Temperature */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Creativity Level</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Temperature</span>
              <span className="font-mono text-xs font-medium bg-muted px-2 py-1 rounded-md">
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
              className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Precise & Focused</span>
              <span>Creative & Varied</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* System Prompt */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">AI Instructions</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <Textarea
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                debouncedSave("system_prompt", e.target.value);
              }}
              placeholder="Custom instructions for the AI when drafting responses...

Example: Always be concise and professional. Sign off with just my first name. Never use exclamation marks."
              rows={5}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              These instructions guide how the AI writes email responses. Be specific about tone, style, and any rules to follow.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Signature */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileSignature className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Email Signature</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <Textarea
              value={signature}
              onChange={(e) => {
                setSignature(e.target.value);
                debouncedSave("signature", e.target.value);
              }}
              placeholder="Enter your email signature..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This signature will be appended to all AI-generated emails
            </p>
            {!signature.trim() && (
              <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                <span>💡</span>
                <span>Tip: Add your name and contact info here so AI drafts include a proper signature.</span>
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Guardrails */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Content Guardrails</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Guardrails prevent auto-sending emails that contain sensitive content. When violations are detected, emails are downgraded to drafts for manual review.
        </p>

        <Card className="mb-4">
          <CardContent className="p-4 space-y-4">
            {/* Profanity Filter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="profanity-filter" className="text-sm font-medium">
                  Profanity Filter
                </Label>
                <p className="text-xs text-muted-foreground">
                  Block emails containing offensive language
                </p>
              </div>
              <Switch
                id="profanity-filter"
                checked={currentSettings?.guardrail_profanity_enabled ?? true}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ guardrail_profanity_enabled: checked })
                }
              />
            </div>

            {/* PII Filter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pii-filter" className="text-sm font-medium">
                  PII Protection
                </Label>
                <p className="text-xs text-muted-foreground">
                  Detect credit cards, SSNs, passwords, and API keys
                </p>
              </div>
              <Switch
                id="pii-filter"
                checked={currentSettings?.guardrail_pii_enabled ?? true}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ guardrail_pii_enabled: checked })
                }
              />
            </div>

            {/* Commitment Filter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="commitment-filter" className="text-sm font-medium">
                  Commitment Detection
                </Label>
                <p className="text-xs text-muted-foreground">
                  Flag binding language like &quot;I agree&quot;, &quot;confirmed&quot;, &quot;I&apos;ll pay&quot;
                </p>
              </div>
              <Switch
                id="commitment-filter"
                checked={currentSettings?.guardrail_commitment_enabled ?? true}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ guardrail_commitment_enabled: checked })
                }
              />
            </div>

            {/* Confidence Threshold */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Confidence Threshold</Label>
                  <p className="text-xs text-muted-foreground">
                    Minimum AI confidence to auto-send
                  </p>
                </div>
                <span className="font-mono text-xs font-medium bg-muted px-2 py-1 rounded-md">
                  {currentSettings?.guardrail_confidence_threshold ?? 0.7}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentSettings?.guardrail_confidence_threshold ?? 0.7}
                onChange={(e) =>
                  updateMutation.mutate({
                    guardrail_confidence_threshold: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>More permissive</span>
                <span>More strict</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Keywords */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Custom Blocked Keywords</Label>
                <p className="text-xs text-muted-foreground">
                  Add your own words or phrases to block
                </p>
              </div>
              <Switch
                checked={currentSettings?.guardrail_custom_keywords_enabled ?? true}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ guardrail_custom_keywords_enabled: checked })
                }
              />
            </div>

            <div className="flex gap-2 mb-3">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                placeholder="Add a keyword..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {blockedKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {blockedKeywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {keyword}
                    <button
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No custom keywords added
              </p>
            )}
          </CardContent>
        </Card>

        {/* Test Guardrails */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TestTube className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Test Your Guardrails</Label>
            </div>
            <Textarea
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              placeholder="Enter sample email content to test against your guardrails..."
              rows={3}
              className="resize-none mb-3"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestGuardrails}
                disabled={!testContent.trim() || isTestingGuardrails}
              >
                {isTestingGuardrails ? (
                  <>
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Content
                  </>
                )}
              </Button>
              {testResult && !testResult.error && (
                <div className="flex items-center gap-2">
                  {testResult.passed ? (
                    <Badge variant="default" className="bg-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Passed
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {testResult.violations?.length || 0} violation(s)
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Show violations */}
            {testResult && !testResult.passed && testResult.violations?.length > 0 && (
              <div className="mt-3 p-3 bg-destructive/10 rounded-lg">
                <p className="text-xs font-medium text-destructive mb-2">
                  Detected violations:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {testResult.violations.map((v: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      <span>{v.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={<LoadingSpinner className="py-16" label="Loading settings..." />}
    >
      <SettingsContent />
    </Suspense>
  );
}
