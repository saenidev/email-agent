"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RegenerateButtonProps {
  onRegenerate: (customPrompt?: string) => void;
  isRegenerating?: boolean;
  disabled?: boolean;
}

export function RegenerateButton({
  onRegenerate,
  isRegenerating = false,
  disabled = false,
}: RegenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleRegenerate = (withPrompt: boolean) => {
    if (withPrompt && customPrompt.trim()) {
      onRegenerate(customPrompt.trim());
    } else {
      onRegenerate();
    }
    setCustomPrompt("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || isRegenerating}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
          {isRegenerating ? "Regenerating..." : "Regenerate"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate Draft</DialogTitle>
          <DialogDescription>
            Generate a new AI response. Optionally provide custom instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Custom Instructions (optional)</Label>
            <Textarea
              id="prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Make it more formal, add a question about timeline, keep it shorter..."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use your default system prompt
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleRegenerate(!!customPrompt.trim())}>
            {customPrompt.trim() ? "Regenerate with Instructions" : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
