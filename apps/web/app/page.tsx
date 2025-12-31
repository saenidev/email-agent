import Link from "next/link";
import { Sparkles, Mail, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Mail,
    title: "Smart Reading",
    description: "Automatically reads and understands your emails",
  },
  {
    icon: Sparkles,
    title: "AI Drafting",
    description: "Generates contextual responses using advanced AI",
  },
  {
    icon: Shield,
    title: "Your Control",
    description: "Review and approve before anything is sent",
  },
  {
    icon: Zap,
    title: "Automation",
    description: "Set rules to auto-respond to specific senders",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          {/* Logo */}
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-warm">
            <Sparkles className="h-8 w-8" />
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
            Your AI Email
            <span className="text-primary"> Assistant</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Let AI read, draft, and send emails on your behalf. Stay in control
            with smart automation and approval workflows.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-warm transition-soft hover:opacity-90"
            >
              Get Started
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 border border-border bg-card rounded-xl font-medium transition-soft hover:bg-accent"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t border-border bg-card/50 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl font-semibold text-center mb-10">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="text-center p-5 rounded-2xl bg-background border border-border shadow-warm"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Email Agent</span>
          </div>
          <p>Powered by AI</p>
        </div>
      </footer>
    </main>
  );
}
