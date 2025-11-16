import { NextRequest, NextResponse } from "next/server";
import { fetchOidcConfig, makeLoggedRequest, decodeIdToken } from "@/lib/oauth";
import { logRequest } from "@/lib/logging";
import {
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  encodeSession,
} from "@/lib/session";

const CLIENT_ID = process.env.CLIENT_ID || "demo-client-id";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "demo-client-secret";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Debug: Log that callback was called
  if (process.env.NODE_ENV === "development") {
    console.log("[callback] ===== CALLBACK ROUTE CALLED =====");
    console.log("[callback] URL:", request.url);
    console.log("[callback] Has code:", !!code);
    console.log("[callback] Has state:", !!state);
    console.log("[callback] Has error:", !!error);
  }

  // Log incoming callback
  logRequest(
    "incoming",
    request.url,
    "GET",
    Object.fromEntries(request.headers.entries()),
    undefined,
    { code: code ? "[CODE_RECEIVED]" : null, state, error },
    undefined,
    new Date().toISOString(),
  );

  if (error) {
    console.error("[callback] OAuth error:", error);
    return NextResponse.redirect(`${BASE_URL}/?error=${encodeURIComponent(error)}`);
  }

  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromRequest(cookieHeader);
  
  if (process.env.NODE_ENV === "development") {
    console.log("[callback] Session from cookie:", Object.keys(session));
    console.log("[callback] Session oauthState:", session.oauthState);
    console.log("[callback] Received state:", state);
  }

  if (state !== session.oauthState) {
    console.error("[callback] State mismatch! Expected:", session.oauthState, "Got:", state);
    return NextResponse.redirect("/?error=invalid_state");
  }

  if (!code) {
    console.error("[callback] No authorization code received");
    return NextResponse.redirect("/?error=no_code");
  }

  // Verify PKCE code_verifier is in session
  if (!session.codeVerifier) {
    console.error("[callback] No code_verifier in session");
    return NextResponse.redirect("/?error=missing_pkce_verifier");
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[callback] All validations passed, proceeding with token exchange");
  }

  try {
    // Ensure OIDC configuration is loaded
    const config = await fetchOidcConfig();

    if (!config.token_endpoint) {
      return NextResponse.redirect("/?error=oidc_config_not_available");
    }

    // Exchange authorization code for access token (with PKCE)
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `${BASE_URL}/auth/callback`,
      code_verifier: session.codeVerifier,
    });

    // Create Basic Auth header
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      "base64",
    );

    const tokenResponse = await makeLoggedRequest({
      method: "POST",
      url: config.token_endpoint!,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      data: tokenParams.toString(),
    });

    const {
      access_token,
      refresh_token,
      id_token,
      expires_in,
    } = tokenResponse.data;

    // Debug: Check what we received
    if (process.env.NODE_ENV === "development") {
      console.log("[callback] Token response received");
      console.log("[callback] Has access_token:", !!access_token);
      console.log("[callback] Has refresh_token:", !!refresh_token);
      console.log("[callback] Has id_token:", !!id_token);
      console.log("[callback] expires_in:", expires_in);
      if (access_token) {
        console.log("[callback] access_token length:", access_token.length);
      }
    }

    if (!access_token) {
      console.error("[callback] No access_token in token response!");
      return NextResponse.redirect("/?error=no_access_token");
    }

    // Decode ID token to extract claims including RAR authorization_details
    let idTokenClaims = null;
    let authorizationDetails = null;

    if (id_token) {
      idTokenClaims = decodeIdToken(id_token);
      if (idTokenClaims && typeof idTokenClaims === 'object' && 'authorization_details' in idTokenClaims) {
        authorizationDetails = (idTokenClaims as any).authorization_details;
      }
    }

    // Check access token for authorization_details
    if (access_token && !authorizationDetails) {
      try {
        const decodedAccess = decodeIdToken(access_token);
        if (decodedAccess && typeof decodedAccess === 'object' && 'authorization_details' in decodedAccess) {
          authorizationDetails = (decodedAccess as any).authorization_details;
        }
      } catch (err) {
        // Ignore
      }
    }

    // Also check token response
    if (tokenResponse.data?.authorization_details && !authorizationDetails) {
      authorizationDetails = tokenResponse.data.authorization_details;
    }

    // Get user info
    let userInfo = null;
    if (config.userinfo_endpoint) {
      try {
        const userInfoResponse = await makeLoggedRequest({
          method: "GET",
          url: config.userinfo_endpoint!,
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "application/json",
          },
        });
        userInfo = userInfoResponse.data;
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    }

    // Update session with tokens and user info
    // Only include defined values to avoid undefined in JSON
    const updatedSession: any = {};
    
    // Always set accessToken and tokenExpiresAt (they should always exist)
    if (access_token) {
      updatedSession.accessToken = access_token;
    } else {
      console.error("[callback] ERROR: access_token is missing!");
    }
    
    if (expires_in) {
      updatedSession.tokenExpiresAt = Date.now() + expires_in * 1000;
    }
    
    if (refresh_token) updatedSession.refreshToken = refresh_token;
    if (id_token) updatedSession.idToken = id_token;
    if (userInfo) updatedSession.userInfo = userInfo;
    if (idTokenClaims) updatedSession.idTokenClaims = idTokenClaims;
    if (authorizationDetails) updatedSession.authorizationDetails = authorizationDetails;

    // Debug logging
    if (process.env.NODE_ENV === "development") {
      console.log("[callback] ===== Session being set =====");
      console.log("[callback] accessToken present:", !!updatedSession.accessToken);
      console.log("[callback] accessToken value (first 20 chars):", updatedSession.accessToken?.substring(0, 20));
      console.log("[callback] Session keys:", Object.keys(updatedSession));
      console.log("[callback] Full session object:", JSON.stringify(updatedSession, null, 2));
    }

    // Create redirect response first
    const response = NextResponse.redirect(`${BASE_URL}/?success=true`);
    
    // Use Next.js cookie API - it handles URL encoding automatically
    // IMPORTANT: This MUST overwrite the existing cookie from login
    const encoded = encodeSession(updatedSession);
    
    // Delete the old cookie first to ensure clean state
    response.cookies.delete(SESSION_COOKIE_NAME);
    
    // Set the new cookie with the accessToken
    response.cookies.set(SESSION_COOKIE_NAME, encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[callback] ===== COOKIE BEING SET =====");
      console.log("[callback] Old cookie deleted");
      console.log("[callback] New cookie set with accessToken:", !!updatedSession.accessToken);
      console.log("[callback] Cookie value length:", encoded.length);
      console.log("[callback] Cookie will be URL encoded by Next.js automatically");
      console.log("[callback] Response headers Set-Cookie:", response.headers.get("Set-Cookie"));
    }

    return response;
  } catch (error: any) {
    console.error(
      "Token exchange error:",
      error.response?.data || error.message,
    );
    return NextResponse.redirect(
      `/?error=${encodeURIComponent(error.response?.data?.error || "token_exchange_failed")}`,
    );
  }
}

