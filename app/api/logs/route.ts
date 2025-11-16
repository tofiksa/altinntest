import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs } from "@/lib/logging";

export async function GET() {
  const logs = getLogs();
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  clearLogs();
  return NextResponse.json({ message: "Logs cleared" });
}

