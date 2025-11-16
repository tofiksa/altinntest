import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("=== /api/user Debug ===");
    console.log("Cookie header present:", !!cookieHeader);
    if (cookieHeader) {
      console.log("Cookie header length:", cookieHeader.length);
      console.log("Contains altinn-session:", cookieHeader.includes("altinn-session"));
      // Extract just the altinn-session cookie value for inspection
      const sessionMatch = cookieHeader.match(/altinn-session=([^;]+)/);
      if (sessionMatch) {
        console.log("Raw altinn-session cookie value (first 100 chars):", sessionMatch[1].substring(0, 100));
        console.log("Raw altinn-session cookie value length:", sessionMatch[1].length);
      }
    }
  }
  
  const session = getSessionFromRequest(cookieHeader);

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("Session keys:", Object.keys(session));
    console.log("Session has accessToken:", !!session.accessToken);
    if (session.accessToken) {
      console.log("AccessToken length:", session.accessToken.length);
      console.log("AccessToken (first 20 chars):", session.accessToken.substring(0, 20));
    } else {
      console.log("WARNING: Session exists but no accessToken!");
      console.log("Full session object:", JSON.stringify(session, null, 2));
    }
  }

  // Return 200 with authenticated: false instead of 401
  // This allows the frontend to distinguish between "not logged in" (200, authenticated: false)
  // and "error" (other status codes)
  if (!session.accessToken) {
    return NextResponse.json({ 
      authenticated: false,
      userInfo: null,
      tokenExpiresAt: null,
      authorizationDetails: null,
      idTokenClaims: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    userInfo: session.userInfo || null,
    tokenExpiresAt: session.tokenExpiresAt,
    authorizationDetails: session.authorizationDetails || null,
    idTokenClaims: session.idTokenClaims || null,
  });
}

