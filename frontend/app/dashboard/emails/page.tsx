"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Mail, MailOpen } from "lucide-react";
import { emailsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function EmailsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["emails"],
    queryFn: () => emailsApi.list(),
  });

  const handleSync = async () => {
    await emailsApi.sync();
    refetch();
  };

  const emails = data?.data?.emails || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button
          onClick={handleSync}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Sync Emails
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading emails...
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No emails yet</p>
          <p className="text-sm">Connect Gmail and sync to see your emails</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {emails.map((email: any) => (
            <div
              key={email.id}
              className={cn(
                "p-4 hover:bg-accent cursor-pointer",
                !email.is_read && "bg-accent/50"
              )}
            >
              <div className="flex items-start gap-3">
                {email.is_read ? (
                  <MailOpen className="h-5 w-5 text-muted-foreground mt-1" />
                ) : (
                  <Mail className="h-5 w-5 text-primary mt-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium truncate">
                      {email.from_name || email.from_email}
                    </p>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {email.received_at &&
                        formatDistanceToNow(new Date(email.received_at), {
                          addSuffix: true,
                        })}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{email.subject}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {email.snippet}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
