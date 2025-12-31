"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Mail, MailOpen, Inbox } from "lucide-react";
import { emailsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function EmailsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["emails"],
    queryFn: () => emailsApi.list(),
  });

  const handleSync = async () => {
    await emailsApi.sync();
    refetch();
  };

  const emails = data?.data?.emails || [];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Your recent emails from Gmail
          </p>
        </div>
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
          {isFetching ? "Syncing..." : "Sync Emails"}
        </button>
      </div>

      {/* Content */}
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
          <h3 className="font-display text-lg font-medium mb-1">No emails yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect Gmail in Settings and sync to see your emails here
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-warm border border-border overflow-hidden">
          {emails.map((email: any, index: number) => (
            <div
              key={email.id}
              className={cn(
                "group p-4 transition-soft hover:bg-accent cursor-pointer",
                !email.is_read && "bg-primary/[0.03]",
                index !== 0 && "border-t border-border"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
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
