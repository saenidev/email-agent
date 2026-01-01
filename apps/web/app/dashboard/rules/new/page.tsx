"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, AlertCircle, Zap, Mail, Ban } from "lucide-react";
import Link from "next/link";
import { rulesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/dashboard/rules">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Rule</h1>
          <p className="text-sm text-muted-foreground">
            Create an automation rule for your emails
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Basic Info */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold">Basic Info</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Auto-respond to support emails"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this rule do?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">
                Priority{" "}
                <span className="text-muted-foreground font-normal">
                  (lower = higher priority)
                </span>
              </Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Conditions</h2>
              <Select
                value={groupOperator}
                onValueChange={(value) => setGroupOperator(value as "AND" | "OR")}
              >
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">Match ALL conditions</SelectItem>
                  <SelectItem value="OR">Match ANY condition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      updateCondition(index, "field", value)
                    }
                  >
                    <SelectTrigger className="w-[120px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      updateCondition(index, "operator", value)
                    }
                  >
                    <SelectTrigger className="w-[160px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(index, "value", e.target.value)
                    }
                    placeholder="Value..."
                    className="flex-1 h-8 text-sm"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length === 1}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addCondition}
              className="mt-3 gap-2 text-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Add condition
            </Button>
          </CardContent>
        </Card>

        {/* Action */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-4">Action</h2>
            <div className="space-y-2">
              {actions.map((a) => {
                const isSelected = action === a.id;
                const Icon = a.icon;

                return (
                  <label
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/[0.02]"
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
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? a.color : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{a.name}</p>
                        {isSelected && <Badge variant="default">Selected</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Custom Prompt (for auto_respond) */}
        {action === "auto_respond" && (
          <Card className="animate-fade-in">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Custom Instructions</h2>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Additional instructions for the AI when generating responses..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                These instructions will be added to the AI prompt when generating
                responses for emails matching this rule.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Rule"
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/rules">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
