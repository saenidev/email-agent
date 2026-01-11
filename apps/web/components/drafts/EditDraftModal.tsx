"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Draft {
  id: string;
  to_emails: string[];
  cc_emails?: string[];
  subject: string;
  body_text: string;
  original_body_text?: string;
  edited_by_user?: boolean;
}

interface EditDraftModalProps {
  draft: Draft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    to_emails: string[];
    cc_emails: string[];
    subject: string;
    body_text: string;
  }) => void;
  isSaving?: boolean;
}

export function EditDraftModal({
  draft,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: EditDraftModalProps) {
  const [toEmails, setToEmails] = useState(draft.to_emails.join(", "));
  const [ccEmails, setCcEmails] = useState(draft.cc_emails?.join(", ") || "");
  const [subject, setSubject] = useState(draft.subject);
  const [bodyText, setBodyText] = useState(draft.body_text);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when draft changes (handles switching between drafts)
  useEffect(() => {
    setToEmails(draft.to_emails.join(", "));
    setCcEmails(draft.cc_emails?.join(", ") || "");
    setSubject(draft.subject);
    setBodyText(draft.body_text);
    setShowOriginal(false);
    setError(null);
  }, [draft.id, draft.to_emails, draft.cc_emails, draft.subject, draft.body_text]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSave = () => {
    const toList = toEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const ccList = ccEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    // Validate at least one recipient
    if (toList.length === 0) {
      setError("At least one recipient is required");
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmails = [...toList, ...ccList];
    const invalidEmails = allEmails.filter((email) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      setError(`Invalid email address: ${invalidEmails[0]}`);
      return;
    }

    setError(null);
    onSave({
      to_emails: toList,
      cc_emails: ccList,
      subject,
      body_text: bodyText,
    });
  };

  const originalText = draft.original_body_text || draft.body_text;
  const hasOriginal = draft.edited_by_user && draft.original_body_text;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Draft</DialogTitle>
          <DialogDescription>
            Make changes to this draft before approving
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To field */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={toEmails}
              onChange={(e) => setToEmails(e.target.value)}
              placeholder="recipient@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple addresses with commas
            </p>
          </div>

          {/* CC field */}
          <div className="space-y-2">
            <Label htmlFor="cc">CC</Label>
            <Input
              id="cc"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="cc@example.com"
            />
          </div>

          {/* Subject field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Re: Subject"
            />
          </div>

          {/* Body field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Write your response..."
            />
          </div>

          {/* Original text collapsible */}
          {hasOriginal && (
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                {showOriginal ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                View AI&apos;s original version
              </button>
              {showOriginal && (
                <div className="px-3 pb-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {originalText}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
