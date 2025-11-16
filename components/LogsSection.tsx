"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Filter, Code2, ArrowRight, Shield } from "lucide-react";

interface LogEntry {
  id: number;
  type: "outgoing" | "incoming";
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, any>;
  requestBody?: any;
  responseBody?: any;
  statusCode?: number;
  duration?: number;
}

type FilterType = "all" | "auth" | "api";

export default function LogsSection() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    
    // Listen for refresh events
    const handleRefresh = () => {
      loadLogs();
    };
    window.addEventListener("refreshLogs", handleRefresh);
    
    // Auto-refresh
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 2000);
    }

    return () => {
      window.removeEventListener("refreshLogs", handleRefresh);
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const clearLogs = async () => {
    if (confirm("Are you sure you want to clear all logs?")) {
      try {
        await fetch("/api/logs", { method: "POST" });
        loadLogs();
      } catch (error) {
        console.error("Error clearing logs:", error);
      }
    }
  };

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const isAuthFlowRequest = (log: LogEntry): boolean => {
    const authKeywords = [
      "/auth/login",
      "/auth/callback",
      "/auth/logout",
      "idporten",
      "authorize",
      "token",
      "/.well-known/openid-configuration",
    ];
    return authKeywords.some((keyword) =>
      log.url.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const isApiRequest = (log: LogEntry): boolean => {
    return log.url.includes("/api/") || log.url.includes("platform.altinn.no") || log.url.includes("apps.altinn.no");
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "auth") return isAuthFlowRequest(log);
    if (filter === "api") return isApiRequest(log);
    return true;
  });

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case "GET":
        return "default";
      case "POST":
        return "secondary";
      case "PUT":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    return type === "outgoing" ? "default" : "secondary";
  };

  const getStatusColor = (status?: number) => {
    if (!status) return "text-muted-foreground";
    if (status >= 200 && status < 300) return "text-green-600";
    if (status >= 400) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">Request/Response Logs</CardTitle>
              <CardDescription>
                Developer view: All HTTP requests and responses between the application, Altinn APIs, and authentication providers
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All ({logs.length})
              </Button>
              <Button
                variant={filter === "auth" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("auth")}
                className="flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                Auth ({logs.filter(isAuthFlowRequest).length})
              </Button>
              <Button
                variant={filter === "api" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("api")}
                className="flex items-center gap-1"
              >
                <Code2 className="h-3 w-3" />
                API ({logs.filter(isApiRequest).length})
              </Button>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={clearLogs}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[600px] overflow-y-auto space-y-3 border rounded-md p-4">
          {filteredLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {logs.length === 0
                ? 'No requests logged yet. Click "Login" to start the authentication flow.'
                : `No logs match the "${filter}" filter.`}
            </p>
          ) : (
            filteredLogs.map((log) => {
              const isAuth = isAuthFlowRequest(log);
              const isApi = isApiRequest(log);
              const isExpanded = expandedLogs.has(log.id);

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border-l-4 transition-all ${
                    isAuth
                      ? "border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                      : log.type === "outgoing"
                      ? "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                  } ${
                    log.statusCode && log.statusCode >= 400
                      ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                      : ""
                  } ${isExpanded ? "shadow-md" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {isAuth && (
                      <Badge variant="secondary" className="bg-purple-600 text-white">
                        <Shield className="h-3 w-3 mr-1" />
                        Auth Flow
                      </Badge>
                    )}
                    {isApi && (
                      <Badge variant="secondary" className="bg-blue-600 text-white">
                        <Code2 className="h-3 w-3 mr-1" />
                        API
                      </Badge>
                    )}
                    <Badge variant={getTypeBadgeVariant(log.type)}>
                      {log.type}
                    </Badge>
                    <Badge variant={getMethodBadgeVariant(log.method)}>
                      {log.method}
                    </Badge>
                    {log.statusCode && (
                      <Badge
                        variant={log.statusCode >= 400 ? "destructive" : "default"}
                      >
                        {log.statusCode}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {log.duration && (
                      <span className="text-xs text-muted-foreground">
                        ({log.duration}ms)
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm break-all mb-2">
                    {log.url}
                  </div>
                  {(log.headers && Object.keys(log.headers).length > 0) ||
                  log.requestBody ||
                  log.responseBody ? (
                    <button
                      onClick={() => toggleLogExpansion(log.id)}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline mb-2"
                    >
                      <ArrowRight
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      {isExpanded ? "Hide" : "Show"} Details
                    </button>
                  ) : null}
                  {isExpanded && (
                    <div className="mt-2 space-y-2 text-xs animate-in slide-in-from-top-2">
                      {log.headers && Object.keys(log.headers).length > 0 && (
                        <div>
                          <div className="font-semibold mb-1">Headers:</div>
                          <pre className="p-2 bg-muted rounded overflow-auto max-h-48 border">
                            {JSON.stringify(log.headers, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.requestBody && (
                        <div>
                          <div className="font-semibold mb-1">Request Body:</div>
                          <pre className="p-2 bg-muted rounded overflow-auto max-h-48 border">
                            {JSON.stringify(log.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.responseBody && (
                        <div>
                          <div className="font-semibold mb-1">Response Body:</div>
                          <pre className="p-2 bg-muted rounded overflow-auto max-h-48 border">
                            {JSON.stringify(log.responseBody, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

