"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, User, Server, Key, Shield } from "lucide-react";

interface AuthFlowStep {
  id: string;
  title: string;
  description: string;
  endpoint?: string;
  status: "pending" | "active" | "completed";
  icon: React.ReactNode;
}

interface AuthFlowDiagramProps {
  authenticated: boolean;
  currentStep?: string;
}

export default function AuthFlowDiagram({ authenticated, currentStep }: AuthFlowDiagramProps) {
  const steps: AuthFlowStep[] = [
    {
      id: "init",
      title: "Initiate Login",
      description: "User clicks login button. App generates PKCE challenge and OAuth state.",
      endpoint: "GET /auth/login",
      status: authenticated ? "completed" : currentStep === "init" ? "active" : "pending",
      icon: <User className="h-5 w-5" />,
    },
    {
      id: "authorize",
      title: "Authorization Request",
      description: "Redirect to ID-porten with authorization code request and PKCE challenge.",
      endpoint: "GET {idporten}/authorize",
      status: authenticated ? "completed" : currentStep === "authorize" ? "active" : "pending",
      icon: <Shield className="h-5 w-5" />,
    },
    {
      id: "callback",
      title: "Authorization Callback",
      description: "ID-porten redirects back with authorization code.",
      endpoint: "GET /auth/callback?code=...&state=...",
      status: authenticated ? "completed" : currentStep === "callback" ? "active" : "pending",
      icon: <ArrowRight className="h-5 w-5" />,
    },
    {
      id: "token",
      title: "Token Exchange",
      description: "Exchange authorization code for access token and ID token using PKCE verifier.",
      endpoint: "POST {idporten}/token",
      status: authenticated ? "completed" : currentStep === "token" ? "active" : "pending",
      icon: <Key className="h-5 w-5" />,
    },
    {
      id: "session",
      title: "Session Storage",
      description: "Store tokens in secure HTTP-only cookie. Session includes access_token, id_token, and user info.",
      endpoint: "Cookie: altinn_session",
      status: authenticated ? "completed" : currentStep === "session" ? "active" : "pending",
      icon: <Server className="h-5 w-5" />,
    },
  ];

  const getStepIcon = (step: AuthFlowStep) => {
    if (step.status === "completed") {
      return <CheckCircle2 className="h-6 w-6 text-green-600" />;
    }
    if (step.status === "active") {
      return <div className="h-6 w-6 rounded-full border-2 border-primary animate-pulse" />;
    }
    return <Circle className="h-6 w-6 text-muted-foreground" />;
  };

  const getStepColor = (step: AuthFlowStep) => {
    if (step.status === "completed") {
      return "border-green-500 bg-green-50/50 dark:bg-green-950/20";
    }
    if (step.status === "active") {
      return "border-primary bg-primary/10";
    }
    return "border-muted bg-muted/30";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Authentication Flow
        </CardTitle>
        <CardDescription>
          Step-by-step OAuth 2.0 / OIDC flow with PKCE. Follow the sequence to understand how authentication works.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              <div
                className={`p-4 rounded-lg border-l-4 ${getStepColor(step)} transition-all duration-300`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                      <Badge
                        variant={
                          step.status === "completed"
                            ? "default"
                            : step.status === "active"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          step.status === "completed"
                            ? "bg-green-600 hover:bg-green-700"
                            : step.status === "active"
                            ? "animate-pulse"
                            : ""
                        }
                      >
                        {step.status === "completed"
                          ? "Completed"
                          : step.status === "active"
                          ? "In Progress"
                          : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {step.endpoint && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                            {step.endpoint}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex justify-center my-2">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        {authenticated && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Authentication Complete
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You are successfully authenticated. Access token and session are stored securely.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

