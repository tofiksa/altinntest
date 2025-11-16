import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export async function GET() {
  const response = NextResponse.redirect(`${BASE_URL}/?logout=true`);
  // Clear the cookie using Next.js cookie API
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

