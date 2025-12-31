"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
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
  { id: "auto_respond", name: "Auto Respond", description: "Automatically send AI response" },
  { id: "draft_only", name: "Draft Only", description: "Create draft for review" },
  { id: "ignore", name: "Ignore", description: "Skip processing this email" },
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

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
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
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/rules"
          className="p-2 hover:bg-accent rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">New Automation Rule</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-respond to support emails"
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this rule do?"
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Priority (lower = higher priority)
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
              min={1}
              max={1000}
              className="w-32 px-3 py-2 border rounded-md bg-background"
            />
          </div>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Conditions</label>
            <select
              value={groupOperator}
              onChange={(e) => setGroupOperator(e.target.value as "AND" | "OR")}
              className="px-2 py-1 text-sm border rounded-md bg-background"
            >
              <option value="AND">Match ALL conditions</option>
              <option value="OR">Match ANY condition</option>
            </select>
          </div>

          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(index, "field", e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, "operator", e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
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
                  onChange={(e) => updateCondition(index, "value", e.target.value)}
                  placeholder="Value..."
                  className="flex-1 px-3 py-2 border rounded-md bg-background"
                />

                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add condition
          </button>
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium mb-3">Action</label>
          <div className="space-y-2">
            {actions.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent",
                  action === a.id && "border-primary bg-primary/5"
                )}
              >
                <input
                  type="radio"
                  name="action"
                  value={a.id}
                  checked={action === a.id}
                  onChange={() => setAction(a.id)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Prompt (for auto_respond) */}
        {action === "auto_respond" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Custom Instructions (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Additional instructions for the AI when generating responses..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Rule"}
          </button>
          <Link
            href="/dashboard/rules"
            className="px-4 py-2 border rounded-md hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
