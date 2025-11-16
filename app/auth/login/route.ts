import { NextRequest, NextResponse } from "next/server";
import { fetchOidcConfig, generatePKCE } from "@/lib/oauth";
import { logRequest } from "@/lib/logging";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/session";

const CLIENT_ID = process.env.CLIENT_ID || "demo-client-id";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OAUTH_SCOPES =
  process.env.OAUTH_SCOPES || "openid profile altinn:instances.read";

export async function GET(request: NextRequest) {
  try {
    // Ensure OIDC configuration is loaded
    const config = await fetchOidcConfig();

    if (!config.authorization_endpoint) {
      return NextResponse.json(
        {
          error:
            "OpenID Connect configuration not available. Check server logs.",
        },
        { status: 500 },
      );
    }

    // Generate PKCE values
    const { codeVerifier, codeChallenge } = generatePKCE();

    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    // Store OAuth state, nonce, and PKCE verifier in session
    const sessionData = {
      oauthState: state,
      oauthNonce: nonce,
      codeVerifier: codeVerifier,
    };

    const redirectUri = `${BASE_URL}/auth/callback`;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: OAUTH_SCOPES,
      state: state,
      nonce: nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Add RAR authorization_details if configured
    const rarAuthorizationDetails = process.env.RAR_AUTHORIZATION_DETAILS;
    if (rarAuthorizationDetails) {
      try {
        const rarDetails = JSON.parse(rarAuthorizationDetails);
        params.append("authorization_details", JSON.stringify(rarDetails));
        console.log(
          "Including RAR authorization_details in authorization request:",
          JSON.stringify(rarDetails, null, 2),
        );
      } catch (err: any) {
        console.error("Error parsing RAR_AUTHORIZATION_DETAILS:", err.message);
      }
    }

    const authUrl = `${config.authorization_endpoint}?${params.toString()}`;

    logRequest(
      "outgoing",
      authUrl,
      "GET",
      {},
      undefined,
      undefined,
      undefined,
      new Date().toISOString(),
    );

    const response = NextResponse.redirect(authUrl);
    
    // Use Next.js cookie API
    const encoded = encodeSession(sessionData);
    response.cookies.set(SESSION_COOKIE_NAME, encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[login] Cookie set with OAuth state:", state);
    }

    return response;
  } catch (error: any) {
    console.error("Error in /auth/login:", error.message);
    return NextResponse.json(
      {
        error: "Failed to initialize authentication. Please check server logs.",
      },
      { status: 500 },
    );
  }
}

