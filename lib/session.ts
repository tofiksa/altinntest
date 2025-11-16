import { cookies } from "next/headers";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export interface SessionData {
  oauthState?: string;
  oauthNonce?: string;
  codeVerifier?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenExpiresAt?: number;
  userInfo?: any;
  idTokenClaims?: any;
  authorizationDetails?: any;
}

export const SESSION_COOKIE_NAME = "altinn-session";

// Encrypt/decrypt session data (simple base64 encoding for now, use proper encryption in production)
export function encodeSession(data: SessionData): string {
  // Remove undefined values before encoding
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
  
  if (process.env.NODE_ENV === "development") {
    console.log("[encodeSession] Encoding session with keys:", Object.keys(cleaned));
    console.log("[encodeSession] Has accessToken:", !!cleaned.accessToken);
  }
  
  const jsonString = JSON.stringify(cleaned);
  const encoded = Buffer.from(jsonString).toString("base64url");
  
  if (process.env.NODE_ENV === "development") {
    console.log("[encodeSession] Encoded length:", encoded.length);
  }
  
  return encoded;
}

function decodeSession(encoded: string): SessionData {
  if (!encoded || encoded.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.error("[decodeSession] Empty encoded string");
    }
    return {};
  }

  // Next.js cookies.set() automatically URL-encodes the value
  // When the browser sends it back, it's automatically URL-decoded
  // But we need to handle both cases: already decoded and still encoded
  
  let decodedString = encoded;
  
  // First, try to decode as base64url directly (if already URL-decoded by browser)
  try {
    const base64Decoded = Buffer.from(decodedString, "base64url").toString();
    const parsed = JSON.parse(base64Decoded);
    
    if (process.env.NODE_ENV === "development") {
      console.log("[decodeSession] Successfully decoded session (direct base64url)");
      console.log("[decodeSession] Decoded keys:", Object.keys(parsed));
      console.log("[decodeSession] Has accessToken:", !!parsed.accessToken);
      if (parsed.accessToken) {
        console.log("[decodeSession] accessToken length:", parsed.accessToken.length);
      } else {
        console.log("[decodeSession] WARNING: accessToken is missing from decoded session!");
        console.log("[decodeSession] Full decoded object:", JSON.stringify(parsed, null, 2));
      }
    }
    
    return parsed;
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.log("[decodeSession] Direct decode failed, trying URL decode first");
      console.log("[decodeSession] Error:", error.message);
      console.log("[decodeSession] Encoded string (first 100 chars):", encoded.substring(0, 100));
    }
    
    // Try URL decoding first (in case Next.js double-encoded or browser didn't decode)
    try {
      decodedString = decodeURIComponent(encoded);
      const base64Decoded = Buffer.from(decodedString, "base64url").toString();
      const parsed = JSON.parse(base64Decoded);
      
      if (process.env.NODE_ENV === "development") {
        console.log("[decodeSession] Successfully decoded after URL decode");
        console.log("[decodeSession] Decoded keys:", Object.keys(parsed));
        console.log("[decodeSession] Has accessToken:", !!parsed.accessToken);
        if (parsed.accessToken) {
          console.log("[decodeSession] accessToken length:", parsed.accessToken.length);
        }
      }
      
      return parsed;
    } catch (e2: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("[decodeSession] Also failed after URL decode:", e2.message);
        console.error("[decodeSession] Attempted decoded string (first 100 chars):", decodedString.substring(0, 100));
      }
    }
  }
  
  return {};
}

export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return {};
  }
  return decodeSession(sessionCookie.value);
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const encoded = encodeSession(data);
  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function clearSessionInResponse(): { "Set-Cookie": string } {
  return {
    "Set-Cookie": `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

// For use in API routes (Request/Response)
export function getSessionFromRequest(
  cookieHeader: string | null
): SessionData {
  if (!cookieHeader) {
    if (process.env.NODE_ENV === "development") {
      console.log("[getSessionFromRequest] No cookie header");
    }
    return {};
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[getSessionFromRequest] Cookie header received, length:", cookieHeader.length);
    console.log("[getSessionFromRequest] Contains altinn-session:", cookieHeader.includes(SESSION_COOKIE_NAME));
  }
  
  const cookies = parseCookies(cookieHeader);
  
  if (process.env.NODE_ENV === "development") {
    console.log("[getSessionFromRequest] Parsed cookies, keys:", Object.keys(cookies));
  }
  
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (!sessionCookie) {
    if (process.env.NODE_ENV === "development") {
      console.log("[getSessionFromRequest] No session cookie found. Available cookies:", Object.keys(cookies));
      // Try to find it with different casing or variations
      const lowerCookies = Object.keys(cookies).map(k => k.toLowerCase());
      if (lowerCookies.includes(SESSION_COOKIE_NAME.toLowerCase())) {
        console.log("[getSessionFromRequest] Found cookie with different casing!");
        const actualKey = Object.keys(cookies).find(k => k.toLowerCase() === SESSION_COOKIE_NAME.toLowerCase());
        if (actualKey) {
          return decodeSession(cookies[actualKey]);
        }
      }
    }
    return {};
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[getSessionFromRequest] Session cookie found, length:", sessionCookie.length);
    console.log("[getSessionFromRequest] Cookie value (first 50 chars):", sessionCookie.substring(0, 50));
  }
  
  const decoded = decodeSession(sessionCookie);
  
  if (process.env.NODE_ENV === "development") {
    console.log("[getSessionFromRequest] Decoded session keys:", Object.keys(decoded));
    console.log("[getSessionFromRequest] Has accessToken:", !!decoded.accessToken);
    if (!decoded.accessToken) {
      console.log("[getSessionFromRequest] WARNING: No accessToken in decoded session!");
      console.log("[getSessionFromRequest] Decoded session:", JSON.stringify(decoded, null, 2));
    }
  }
  
  return decoded;
}

export function setSessionInResponse(
  data: SessionData
): { "Set-Cookie": string } {
  const encoded = encodeSession(data);
  // URL encode the cookie value to ensure special characters are handled
  const encodedValue = encodeURIComponent(encoded);
  return {
    "Set-Cookie": `${SESSION_COOKIE_NAME}=${encodedValue}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }
  
  // Split by semicolon, but be careful with values that might contain semicolons
  // (though cookie values shouldn't, but we'll handle it)
  const cookiePairs = cookieHeader.split(";");
  
  cookiePairs.forEach((cookie) => {
    const trimmed = cookie.trim();
    if (!trimmed) return;
    
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      // Cookie without value (like "HttpOnly" flag, but those shouldn't be in the header)
      return;
    }
    
    const name = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    
    if (!name) return;
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Next.js cookies.set() automatically URL-encodes cookie values
    // When the browser sends cookies back in the Cookie header, they are automatically URL-decoded
    // However, we need to handle edge cases where encoding might still be present
    // Try to decode - if it fails (invalid encoding), the value is already decoded
    try {
      // Only decode if it looks like it might be encoded (contains %)
      if (value.includes('%')) {
        cookies[name] = decodeURIComponent(value);
      } else {
        // No encoding markers, use as-is
        cookies[name] = value;
      }
    } catch (error) {
      // If decoding fails, the value is likely already decoded or has invalid encoding
      // Use it as-is
      if (process.env.NODE_ENV === "development") {
        console.log(`[parseCookies] Failed to decode cookie "${name}", using as-is. Error:`, error);
      }
      cookies[name] = value;
    }
  });
  
  return cookies;
}

