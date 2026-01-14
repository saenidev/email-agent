"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { FileEdit, Check, X, Sparkles, Pencil } from "lucide-react";
import { draftsApi } from "@/lib/api";
import { PageHeader, EmptyState, LoadingSpinner, StatusBadge } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditDraftModal } from "@/components/drafts/EditDraftModal";
import { RegenerateButton } from "@/components/drafts/RegenerateButton";

type DraftStatus = "pending" | "approved" | "sent" | "auto_sent" | "rejected";

interface Draft {
  id: string;
  email_id: string;
  to_emails: string[];
  cc_emails?: string[];
  subject: string;
  body_text: string;
  status: DraftStatus;
  llm_model_used?: string;
  created_at: string;
  original_body_text?: string;
  edited_by_user?: boolean;
}

export default function DraftsPage() {
  const queryClient = useQueryClient();
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["drafts"],
    queryFn: () => draftsApi.list(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => draftsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => draftsApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        to_emails?: string[];
        cc_emails?: string[];
        subject?: string;
        body_text?: string;
      };
    }) => draftsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      setEditingDraft(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: ({ id, customPrompt }: { id: string; customPrompt?: string }) =>
      draftsApi.regenerate(id, customPrompt),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
    onError: (_, variables) => {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  const handleSaveEdit = (data: {
    to_emails: string[];
    cc_emails: string[];
    subject: string;
    body_text: string;
  }) => {
    if (editingDraft) {
      updateMutation.mutate({ id: editingDraft.id, data });
    }
  };

  const handleRegenerate = (draftId: string, customPrompt?: string) => {
    setRegeneratingIds((prev) => new Set(prev).add(draftId));
    regenerateMutation.mutate({ id: draftId, customPrompt });
  };

  const drafts: Draft[] = data?.data?.drafts || [];
  const isActionPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Drafts"
        description="AI-generated responses waiting for your review"
      />

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-16" label="Loading drafts..." />
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="No drafts yet"
          description="AI-generated email responses will appear here for your approval"
        />
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <Card key={draft.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Status and time */}
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={draft.status} />
                    {draft.edited_by_user && (
                      <Badge variant="outline" className="text-xs">
                        Edited
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(draft.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {/* Recipients and subject */}
                  <p className="font-medium text-sm mb-0.5">
                    To: {draft.to_emails.join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {draft.subject}
                  </p>

                  {/* Full draft body */}
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                    {draft.body_text}
                  </div>

                  {/* Model attribution */}
                  {draft.llm_model_used && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Generated by {draft.llm_model_used}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {draft.status === "pending" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingDraft(draft)}
                      disabled={isActionPending || regeneratingIds.has(draft.id)}
                      className="gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <RegenerateButton
                      onRegenerate={(prompt) => handleRegenerate(draft.id, prompt)}
                      isRegenerating={regeneratingIds.has(draft.id)}
                      disabled={isActionPending}
                    />
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(draft.id)}
                      disabled={isActionPending || regeneratingIds.has(draft.id)}
                      className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate(draft.id)}
                      disabled={isActionPending || regeneratingIds.has(draft.id)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal - key resets state when switching drafts */}
      {editingDraft && (
        <EditDraftModal
          key={editingDraft.id}
          draft={editingDraft}
          open={!!editingDraft}
          onOpenChange={(open) => !open && setEditingDraft(null)}
          onSave={handleSaveEdit}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
