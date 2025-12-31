"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, FileEdit, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { gmailApi } from "@/lib/api";

export default function DashboardPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  useEffect(() => {
    gmailApi.getStatus().then((res) => {
      setGmailConnected(res.data.connected);
      setGmailEmail(res.data.email);
    });
  }, []);

  const handleConnectGmail = async () => {
    const res = await gmailApi.getAuthUrl();
    window.location.href = res.data.auth_url;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Gmail Connection Status */}
      <div className="mb-8 p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gmailConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Gmail Connected</p>
                  <p className="text-sm text-muted-foreground">{gmailEmail}</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium">Gmail Not Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Gmail to start using the email agent
                  </p>
                </div>
              </>
            )}
          </div>
          {!gmailConnected && (
            <button
              onClick={handleConnectGmail}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Connect Gmail
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/emails"
          className="p-6 rounded-lg border bg-card hover:bg-accent transition-colors"
        >
          <Inbox className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Inbox</h3>
          <p className="text-sm text-muted-foreground">
            View and manage your emails
          </p>
        </Link>

        <Link
          href="/dashboard/drafts"
          className="p-6 rounded-lg border bg-card hover:bg-accent transition-colors"
        >
          <FileEdit className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Drafts</h3>
          <p className="text-sm text-muted-foreground">
            Review and approve AI-generated drafts
          </p>
        </Link>

        <Link
          href="/dashboard/rules"
          className="p-6 rounded-lg border bg-card hover:bg-accent transition-colors"
        >
          <Filter className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1">Rules</h3>
          <p className="text-sm text-muted-foreground">
            Configure automation rules
          </p>
        </Link>
      </div>
    </div>
  );
}
