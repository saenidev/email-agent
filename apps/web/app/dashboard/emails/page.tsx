"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Mail,
  MailOpen,
  Inbox,
  Sparkles,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { emailsApi, BatchDraftJobStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEmailSelection } from "@/hooks/useEmailSelection";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function EmailsPage() {
  const queryClient = useQueryClient();
  const [showUnrepliedOnly, setShowUnrepliedOnly] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Fetch emails (either all or unreplied)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["emails", showUnrepliedOnly ? "unreplied" : "all"],
    queryFn: () =>
      showUnrepliedOnly ? emailsApi.listUnreplied() : emailsApi.list(),
  });

  const emails = data?.data?.emails || [];
  const {
    selectedIds,
    selectedCount,
    allSelected,
    toggleEmail,
    selectAll,
    deselectAll,
    isSelected,
  } = useEmailSelection(emails);

  // Clear selection when switching modes
  useEffect(() => {
    deselectAll();
  }, [showUnrepliedOnly, deselectAll]);

  useEffect(() => {
    if (selectionError && selectedCount <= 20) {
      setSelectionError(null);
    }
  }, [selectedCount, selectionError]);

  // Mutation for generating drafts
  const generateDraftsMutation = useMutation({
    mutationFn: (emailIds: string[]) => emailsApi.generateDrafts(emailIds),
    onSuccess: (response) => {
      setBatchJobId(response.data.id);
      deselectAll();
      setSelectionError(null);
    },
    onError: (error: any) => {
      setSelectionError(
        error?.response?.data?.detail || "Failed to generate drafts"
      );
    },
  });

  // Poll batch job status
  const { data: batchStatus } = useQuery({
    queryKey: ["batchJob", batchJobId],
    queryFn: () => emailsApi.getBatchJobStatus(batchJobId!),
    enabled: !!batchJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === "completed" || status === "failed") {
        return false; // Stop polling
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Auto-clear batch job after completion
  useEffect(() => {
    if (
      batchStatus?.data?.status === "completed" ||
      batchStatus?.data?.status === "failed"
    ) {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      const timer = setTimeout(() => setBatchJobId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [batchStatus?.data?.status, queryClient]);

  const handleSync = async () => {
    await emailsApi.sync();
    refetch();
  };

  const handleGenerateDrafts = () => {
    if (selectedCount > 20) {
      setSelectionError("Select up to 20 emails at a time.");
      return;
    }
    if (selectedCount > 0) {
      generateDraftsMutation.mutate(selectedIds);
    }
  };

  const batchJobData = batchStatus?.data as BatchDraftJobStatus | undefined;
  const isJobActive =
    batchJobId &&
    batchJobData &&
    (batchJobData.status === "pending" || batchJobData.status === "processing");
  const isJobComplete = batchJobData?.status === "completed";

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Inbox"
        description={
          showUnrepliedOnly
            ? "Emails awaiting your response"
            : "Your recent emails from Gmail"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showUnrepliedOnly ? "default" : "secondary"}
              size="sm"
              onClick={() => setShowUnrepliedOnly(!showUnrepliedOnly)}
            >
              {showUnrepliedOnly ? "Unreplied Only" : "All Emails"}
            </Button>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
              {isFetching ? "Syncing..." : "Sync"}
            </Button>
          </div>
        }
      />

      {/* Selection Bar - appears when emails selected */}
      {selectedCount > 0 && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={deselectAll}
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {selectedCount} email{selectedCount !== 1 ? "s" : ""} selected
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateDrafts}
            disabled={generateDraftsMutation.isPending || selectedCount > 20}
            className="gap-2"
          >
            {generateDraftsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Drafts
          </Button>
        </div>
      )}

      {selectionError && (
        <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg animate-fade-in">
          {selectionError}
        </div>
      )}

      {/* Batch Job Progress */}
      {batchJobId && batchJobData && (
        <Card className="mb-4 p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isJobActive ? (
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 text-success" />
              )}
              <span className="text-sm font-medium">
                {isJobActive
                  ? "Generating drafts..."
                  : isJobComplete
                    ? "Drafts generated!"
                    : "Generation failed"}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {batchJobData.completed_emails} / {batchJobData.total_emails}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-out rounded-full",
                isJobComplete ? "bg-success" : "bg-primary"
              )}
              style={{
                width: `${(batchJobData.completed_emails / batchJobData.total_emails) * 100}%`,
              }}
            />
          </div>
          {isJobComplete && (
            <p className="text-xs text-success mt-2">
              {batchJobData.failed_emails > 0
                ? `Generated ${batchJobData.completed_emails} drafts, ${batchJobData.failed_emails} failed.`
                : "All drafts generated! Check the Drafts page."}
            </p>
          )}
        </Card>
      )}

      {/* Email List */}
      {isLoading ? (
        <LoadingSpinner className="py-16" label="Loading emails..." />
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={showUnrepliedOnly ? "All caught up!" : "No emails yet"}
          description={
            showUnrepliedOnly
              ? "You have responded to all your emails"
              : "Connect Gmail in Settings and sync to see your emails here"
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Select All Header - only in unreplied mode */}
          {showUnrepliedOnly && emails.length > 0 && (
            <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => (allSelected ? deselectAll() : selectAll())}
              />
              <span className="text-xs text-muted-foreground">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </div>
          )}

          {emails.map((email: any, index: number) => (
            <div
              key={email.id}
              className={cn(
                "group px-3 py-2.5 transition-colors hover:bg-accent cursor-pointer",
                !email.is_read && "bg-primary/[0.02]",
                index !== 0 && "border-t border-border",
                isSelected(email.id) && "bg-primary/[0.05]"
              )}
              onClick={() => showUnrepliedOnly && toggleEmail(email.id)}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox - only show in unreplied mode */}
                {showUnrepliedOnly && (
                  <div
                    className="pt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEmail(email.id);
                    }}
                  >
                    <Checkbox checked={isSelected(email.id)} />
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    email.is_read
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {email.is_read ? (
                    <MailOpen className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <p
                      className={cn(
                        "text-sm truncate",
                        !email.is_read && "font-medium"
                      )}
                    >
                      {email.from_name || email.from_email}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {email.received_at &&
                        formatDistanceToNow(new Date(email.received_at), {
                          addSuffix: true,
                        })}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm truncate",
                      !email.is_read
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {email.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {email.snippet}
                  </p>
                </div>

                {/* Unread indicator */}
                {!email.is_read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
