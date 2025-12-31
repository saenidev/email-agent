"use client";

import { Activity, Mail, FileEdit, Send, Filter } from "lucide-react";

const activityIcons: Record<string, any> = {
  email_received: Mail,
  draft_created: FileEdit,
  email_sent: Send,
  rule_matched: Filter,
};

// Mock data - will be replaced with API call
const mockActivity = [
  {
    id: "1",
    activity_type: "email_received",
    description: "Received email from john@example.com",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    activity_type: "draft_created",
    description: "AI drafted response for email from john@example.com",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export default function ActivityPage() {
  // TODO: Replace with actual API call
  const activities = mockActivity;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Activity Log</h1>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activity yet</p>
          <p className="text-sm">
            Activity from the email agent will appear here
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.activity_type] || Activity;
            return (
              <div key={activity.id} className="p-4 flex items-start gap-3">
                <div className="p-2 bg-secondary rounded-md">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
