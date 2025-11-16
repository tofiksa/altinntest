// In-memory storage for logs (in production, use a database)
let requestLogs: LogEntry[] = [];
const MAX_LOGS = 1000;

export interface LogEntry {
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

export function logRequest(
  type: "outgoing" | "incoming",
  url: string,
  method: string,
  headers: Record<string, any>,
  body?: any,
  response?: any,
  status?: number,
  timestamp?: string,
): LogEntry {
  const logEntry: LogEntry = {
    id: requestLogs.length + 1,
    type,
    timestamp: timestamp || new Date().toISOString(),
    method: method || "GET",
    url,
    headers: headers ? JSON.parse(JSON.stringify(headers)) : {},
    requestBody: body,
    responseBody: response,
    statusCode: status,
    duration: timestamp
      ? Date.now() - new Date(timestamp).getTime()
      : undefined,
  };

  // Remove sensitive data from logs
  if (logEntry.headers.authorization) {
    logEntry.headers.authorization = "[REDACTED]";
  }
  if (logEntry.headers.cookie) {
    logEntry.headers.cookie = "[REDACTED]";
  }

  requestLogs.unshift(logEntry);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.pop();
  }

  return logEntry;
}

export function getLogs(): LogEntry[] {
  return requestLogs;
}

export function clearLogs(): void {
  requestLogs = [];
}

