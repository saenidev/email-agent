"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox,
  FileEdit,
  Filter,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Activity,
} from "lucide-react";
import { gmailApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const quickActions = [
  {
    title: "Inbox",
    description: "View and manage your emails",
    href: "/dashboard/emails",
    icon: Inbox,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "Drafts",
    description: "Review AI-generated drafts",
    href: "/dashboard/drafts",
    icon: FileEdit,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Rules",
    description: "Configure automation rules",
    href: "/dashboard/rules",
    icon: Filter,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    title: "Activity",
    description: "View agent activity log",
    href: "/dashboard/activity",
    icon: Activity,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
];

export default function DashboardPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gmailApi
      .getStatus()
      .then((res) => {
        setGmailConnected(res.data.connected);
        setGmailEmail(res.data.email);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnectGmail = async () => {
    const res = await gmailApi.getAuthUrl();
    window.location.href = res.data.auth_url;
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your AI-powered email assistant
        </p>
      </div>

      {/* Gmail Connection Status */}
      <div
        className={cn(
          "mb-8 p-5 rounded-2xl border shadow-warm transition-soft",
          gmailConnected
            ? "bg-success/5 border-success/20"
            : "bg-warning/5 border-warning/20"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center",
                gmailConnected ? "bg-success/10" : "bg-warning/10"
              )}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              ) : gmailConnected ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {gmailConnected ? "Gmail Connected" : "Gmail Not Connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {gmailConnected
                  ? gmailEmail
                  : "Connect your Gmail to start using the email agent"}
              </p>
            </div>
          </div>
          {!loading && !gmailConnected && (
            <button
              onClick={handleConnectGmail}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90"
            >
              Connect Gmail
            </button>
          )}
        </div>
      </div>

      {/* AI Status Banner */}
      <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">AI-Powered Email Agent</p>
            <p className="text-sm text-muted-foreground">
              Your assistant automatically drafts responses based on your rules
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold mb-4">Quick Actions</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className="group p-5 rounded-2xl border border-border bg-card shadow-warm transition-soft hover:shadow-warm-lg hover:border-primary/20"
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-xl flex items-center justify-center transition-soft",
                  action.color
                )}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </div>
            <h3 className="font-semibold mb-1">{action.title}</h3>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
