"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Inbox,
  Sparkles,
  Loader2,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
} from "lucide-react";
import { emailsApi, BatchDraftJobStatus } from "@/lib/api";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { useEmailSelection } from "@/hooks/useEmailSelection";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type SortField = "date" | "sender" | "subject";
type SortDirection = "asc" | "desc";

interface SortIconProps {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}

function SortIcon({ field, sortField, sortDirection }: SortIconProps) {
  if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
  return sortDirection === "asc"
    ? <ArrowUp className="h-3.5 w-3.5" />
    : <ArrowDown className="h-3.5 w-3.5" />;
}

export default function EmailsPage() {
  const queryClient = useQueryClient();
  const [showUnrepliedOnly, setShowUnrepliedOnly] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Email preview state
  const [previewEmail, setPreviewEmail] = useState<any | null>(null);

  // Fetch emails (either all or unreplied)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["emails", showUnrepliedOnly ? "unreplied" : "all", currentPage],
    queryFn: () =>
      showUnrepliedOnly
        ? emailsApi.listUnreplied(currentPage, pageSize)
        : emailsApi.list(currentPage, pageSize),
  });

  // Get pagination info from response
  const totalEmails = data?.data?.total || 0;
  const totalPages = Math.ceil(totalEmails / pageSize);

  const rawEmails = data?.data?.emails || [];

  // Filter and sort emails
  const emails = useMemo(() => {
    let filtered = rawEmails;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((email: any) =>
        (email.from_name?.toLowerCase().includes(query)) ||
        (email.from_email?.toLowerCase().includes(query)) ||
        (email.subject?.toLowerCase().includes(query)) ||
        (email.snippet?.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a: any, b: any) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
          break;
        case "sender":
          const senderA = (a.from_name || a.from_email || "").toLowerCase();
          const senderB = (b.from_name || b.from_email || "").toLowerCase();
          comparison = senderA.localeCompare(senderB);
          break;
        case "subject":
          comparison = (a.subject || "").toLowerCase().localeCompare((b.subject || "").toLowerCase());
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [rawEmails, searchQuery, sortField, sortDirection]);
  const {
    selectedIds,
    selectedCount,
    allSelected,
    toggleEmail,
    selectAll,
    deselectAll,
    isSelected,
  } = useEmailSelection(emails);

  // Handler for toggling unreplied filter - clears selection and resets page
  const handleToggleUnreplied = () => {
    deselectAll();
    setCurrentPage(1);
    setShowUnrepliedOnly(prev => !prev);
  };

  // Clear selection error when under limit - computed in handlers instead of useEffect
  const handleEmailToggle = (emailId: string) => {
    toggleEmail(emailId);
    // Clear error when selection changes and is now under limit
    if (selectionError && selectedCount <= 20) {
      setSelectionError(null);
    }
  };

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

  const toggleSort = (field: SortField) => {
    // Clear selection when sort changes to avoid confusion about what's selected
    deselectAll();

    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
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
              onClick={handleToggleUnreplied}
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

      {/* Search and Filter Bar */}
      <div className="mb-4 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search emails by sender, subject, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <div className="flex items-center gap-1">
            <Button
              variant={sortField === "date" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => toggleSort("date")}
            >
              Date
              <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
            </Button>
            <Button
              variant={sortField === "sender" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => toggleSort("sender")}
            >
              Sender
              <SortIcon field="sender" sortField={sortField} sortDirection={sortDirection} />
            </Button>
            <Button
              variant={sortField === "subject" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => toggleSort("subject")}
            >
              Subject
              <SortIcon field="subject" sortField={sortField} sortDirection={sortDirection} />
            </Button>
          </div>

          {/* Results count */}
          {(searchQuery || rawEmails.length !== emails.length) && (
            <span className="text-xs text-muted-foreground ml-auto">
              {emails.length} of {rawEmails.length} emails
            </span>
          )}
        </div>
      </div>

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
          icon={searchQuery ? Search : Inbox}
          title={
            searchQuery
              ? "No emails found"
              : showUnrepliedOnly
                ? "All caught up!"
                : "No emails yet"
          }
          description={
            searchQuery
              ? `No emails match "${searchQuery}". Try a different search.`
              : showUnrepliedOnly
                ? "You have responded to all your emails"
                : "Connect Gmail in Settings and sync to see your emails here"
          }
          action={
            searchQuery ? (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            ) : undefined
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
                "group relative px-4 py-3 transition-all duration-200 cursor-pointer",
                "hover:bg-accent/60 hover:shadow-sm",
                !email.is_read && "bg-primary/[0.03]",
                index !== 0 && "border-t border-border/50",
                isSelected(email.id) && "bg-primary/[0.08] ring-1 ring-primary/20",
                "animate-fade-in-up"
              )}
              style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}
              onClick={() => {
                if (showUnrepliedOnly) {
                  handleEmailToggle(email.id);
                } else {
                  setPreviewEmail(email);
                }
              }}
            >
              {/* Unread indicator - animated left bar */}
              {!email.is_read && (
                <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-primary rounded-full transition-transform group-hover:scale-y-110" />
              )}

              <div className="flex items-start gap-3">
                {/* Checkbox - only show in unreplied mode */}
                {showUnrepliedOnly && (
                  <div
                    className="pt-0.5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmailToggle(email.id);
                    }}
                  >
                    <Checkbox checked={isSelected(email.id)} />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className={cn(
                          "text-sm truncate",
                          !email.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {email.from_name || email.from_email}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {email.received_at &&
                        formatDistanceToNow(new Date(email.received_at), {
                          addSuffix: true,
                        })}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm truncate mt-0.5",
                      !email.is_read
                        ? "font-medium text-foreground"
                        : "text-foreground/80"
                    )}
                  >
                    {email.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1 leading-relaxed">
                    {decodeHtmlEntities(email.snippet)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {searchQuery ? (
              // When searching, show filtered count (client-side filtering)
              <>Showing {emails.length} of {totalEmails} emails</>
            ) : (
              // When not searching, show server pagination info
              <>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalEmails)} of {totalEmails} emails</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isFetching}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={isFetching}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isFetching}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Email Preview Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={(open) => !open && setPreviewEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {previewEmail?.subject || "(No subject)"}
                </DialogTitle>
                <DialogDescription className="mt-2 flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-foreground">
                      {previewEmail?.from_name || previewEmail?.from_email}
                    </span>
                    {previewEmail?.from_name && (
                      <span className="text-muted-foreground">
                        &lt;{previewEmail?.from_email}&gt;
                      </span>
                    )}
                  </span>
                  {previewEmail?.received_at && (
                    <span className="text-xs">
                      {formatDistanceToNow(new Date(previewEmail.received_at), { addSuffix: true })}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {previewEmail?.snippet ? decodeHtmlEntities(previewEmail.snippet) : "No preview available"}
              </p>
              <p className="text-xs text-muted-foreground mt-4 italic">
                This is a preview snippet. Open in Gmail to view the full email.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            {previewEmail?.gmail_id && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  window.open(
                    `https://mail.google.com/mail/u/0/#inbox/${previewEmail.gmail_id}`,
                    "_blank"
                  );
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Gmail
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => setPreviewEmail(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
