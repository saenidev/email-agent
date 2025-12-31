"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, AlertCircle, Zap, Mail, Ban } from "lucide-react";
import Link from "next/link";
import { rulesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const fields = [
  { id: "from_email", name: "From Email" },
  { id: "from_name", name: "From Name" },
  { id: "subject", name: "Subject" },
  { id: "body_text", name: "Body" },
];

const operators = [
  { id: "contains", name: "Contains" },
  { id: "not_contains", name: "Does not contain" },
  { id: "equals", name: "Equals" },
  { id: "not_equals", name: "Does not equal" },
  { id: "starts_with", name: "Starts with" },
  { id: "ends_with", name: "Ends with" },
];

const actions = [
  {
    id: "auto_respond",
    name: "Auto Respond",
    description: "Automatically send AI response",
    icon: Zap,
    color: "bg-success/10 text-success",
  },
  {
    id: "draft_only",
    name: "Draft Only",
    description: "Create draft for review",
    icon: Mail,
    color: "bg-primary/10 text-primary",
  },
  {
    id: "ignore",
    name: "Ignore",
    description: "Skip processing this email",
    icon: Ban,
    color: "bg-muted text-muted-foreground",
  },
];

interface Condition {
  field: string;
  operator: string;
  value: string;
}

export default function NewRulePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(100);
  const [action, setAction] = useState("draft_only");
  const [groupOperator, setGroupOperator] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "from_email", operator: "contains", value: "" },
  ]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: "from_email", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (
    index: number,
    field: keyof Condition,
    value: string
  ) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Rule name is required");
      return;
    }

    if (conditions.some((c) => !c.value.trim())) {
      setError("All conditions must have a value");
      return;
    }

    setLoading(true);

    try {
      const ruleData = {
        name,
        description: description || null,
        priority,
        action,
        conditions: {
          operator: groupOperator,
          rules: conditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })),
        },
        action_config:
          action === "auto_respond" && customPrompt
            ? { custom_prompt: customPrompt }
            : null,
      };

      await rulesApi.create(ruleData);
      router.push("/dashboard/rules");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create rule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/rules"
          className="p-2.5 hover:bg-accent rounded-xl transition-soft"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            New Rule
          </h1>
          <p className="text-muted-foreground mt-0.5">
            Create an automation rule for your emails
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 rounded-xl animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold">Basic Info</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-respond to support emails"
              className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this rule do?"
              className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Priority{" "}
              <span className="text-muted-foreground font-normal">
                (lower = higher priority)
              </span>
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
              min={1}
              max={1000}
              className="w-32 px-3.5 py-2.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft"
            />
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Conditions</h2>
            <select
              value={groupOperator}
              onChange={(e) => setGroupOperator(e.target.value as "AND" | "OR")}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-soft"
            >
              <option value="AND">Match ALL conditions</option>
              <option value="OR">Match ANY condition</option>
            </select>
          </div>

          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-accent/50 rounded-xl"
              >
                <select
                  value={condition.field}
                  onChange={(e) =>
                    updateCondition(index, "field", e.target.value)
                  }
                  className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-soft"
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(index, "operator", e.target.value)
                  }
                  className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-soft"
                >
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(index, "value", e.target.value)
                  }
                  placeholder="Value..."
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-soft"
                />

                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-soft disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="mt-4 flex items-center gap-2 text-sm text-primary font-medium hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add condition
          </button>
        </div>

        {/* Action */}
        <div className="bg-card rounded-2xl shadow-warm border border-border p-5">
          <h2 className="font-display text-lg font-semibold mb-4">Action</h2>
          <div className="space-y-3">
            {actions.map((a) => {
              const isSelected = action === a.id;
              const Icon = a.icon;

              return (
                <label
                  key={a.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-soft",
                    isSelected
                      ? "border-primary bg-primary/[0.02] shadow-warm"
                      : "border-border hover:border-primary/30 hover:bg-accent/50"
                  )}
                >
                  <input
                    type="radio"
                    name="action"
                    value={a.id}
                    checked={isSelected}
                    onChange={() => setAction(a.id)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-soft",
                      isSelected ? a.color : "bg-accent text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.name}</p>
                      {isSelected && (
                        <span className="badge badge-approved">Selected</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {a.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Custom Prompt (for auto_respond) */}
        {action === "auto_respond" && (
          <div className="bg-card rounded-2xl shadow-warm border border-border p-5 animate-fade-in">
            <h2 className="font-display text-lg font-semibold mb-4">
              Custom Instructions
            </h2>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Additional instructions for the AI when generating responses..."
              rows={4}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-soft resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              These instructions will be added to the AI prompt when generating
              responses for emails matching this rule.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Rule"
            )}
          </button>
          <Link
            href="/dashboard/rules"
            className="px-5 py-2.5 border border-border rounded-xl font-medium transition-soft hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
