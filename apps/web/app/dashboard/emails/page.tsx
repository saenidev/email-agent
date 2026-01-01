"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Mail,
  MailOpen,
  Inbox,
  Square,
  CheckSquare,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { emailsApi, BatchDraftJobStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEmailSelection } from "@/hooks/useEmailSelection";

export default function EmailsPage() {
  const queryClient = useQueryClient();
  const [showUnrepliedOnly, setShowUnrepliedOnly] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);

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

  // Mutation for generating drafts
  const generateDraftsMutation = useMutation({
    mutationFn: (emailIds: string[]) => emailsApi.generateDrafts(emailIds),
    onSuccess: (response) => {
      setBatchJobId(response.data.id);
      deselectAll();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            {showUnrepliedOnly
              ? "Emails awaiting your response"
              : "Your recent emails from Gmail"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <button
            onClick={() => setShowUnrepliedOnly(!showUnrepliedOnly)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-medium transition-soft",
              showUnrepliedOnly
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            {showUnrepliedOnly ? "Unreplied Only" : "All Emails"}
          </button>
          <button
            onClick={handleSync}
            disabled={isFetching}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90 disabled:opacity-50",
              isFetching && "cursor-wait"
            )}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            {isFetching ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* Selection Bar - appears when emails selected */}
      {selectedCount > 0 && (
        <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-3">
            <button
              onClick={deselectAll}
              className="p-1.5 rounded-lg hover:bg-accent transition-soft"
              title="Clear selection"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <span className="text-sm font-medium">
              {selectedCount} email{selectedCount !== 1 ? "s" : ""} selected
            </span>
          </div>
          <button
            onClick={handleGenerateDrafts}
            disabled={generateDraftsMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium transition-soft hover:opacity-90 disabled:opacity-50"
          >
            {generateDraftsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Drafts
          </button>
        </div>
      )}

      {/* Batch Job Progress */}
      {batchJobId && batchJobData && (
        <div className="mb-4 p-4 bg-card border border-border rounded-2xl shadow-warm animate-fade-in-up">
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
          <div className="h-2 bg-accent rounded-full overflow-hidden">
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
            <p className="text-sm text-success mt-2">
              {batchJobData.failed_emails > 0
                ? `Generated ${batchJobData.completed_emails} drafts, ${batchJobData.failed_emails} failed.`
                : "All drafts generated! Check the Drafts page."}
            </p>
          )}
        </div>
      )}

      {/* Email List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p>Loading emails...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-medium mb-1">
            {showUnrepliedOnly ? "All caught up!" : "No emails yet"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {showUnrepliedOnly
              ? "You have responded to all your emails"
              : "Connect Gmail in Settings and sync to see your emails here"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-warm border border-border overflow-hidden">
          {/* Select All Header - only in unreplied mode */}
          {showUnrepliedOnly && emails.length > 0 && (
            <div className="px-4 py-3 border-b border-border bg-accent/30 flex items-center gap-3">
              <button
                onClick={allSelected ? deselectAll : selectAll}
                className="p-1 rounded hover:bg-accent transition-soft"
              >
                {allSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <span className="text-sm text-muted-foreground">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </div>
          )}

          {emails.map((email: any, index: number) => (
            <div
              key={email.id}
              className={cn(
                "group p-4 transition-soft hover:bg-accent cursor-pointer",
                !email.is_read && "bg-primary/[0.03]",
                index !== 0 && "border-t border-border",
                isSelected(email.id) && "bg-primary/[0.08]"
              )}
              onClick={() => showUnrepliedOnly && toggleEmail(email.id)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox - only show in unreplied mode */}
                {showUnrepliedOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEmail(email.id);
                    }}
                    className="mt-0.5 p-1 rounded hover:bg-accent transition-soft"
                  >
                    {isSelected(email.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                    )}
                  </button>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-soft",
                    email.is_read
                      ? "bg-accent text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {email.is_read ? (
                    <MailOpen className="h-5 w-5" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-0.5">
                    <p
                      className={cn(
                        "font-medium truncate",
                        !email.is_read && "text-foreground"
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
                      "text-sm truncate mb-0.5",
                      !email.is_read
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {email.subject}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {email.snippet}
                  </p>
                </div>

                {/* Unread indicator */}
                {!email.is_read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
