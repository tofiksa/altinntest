import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { logRequest } from "./logging";

// OpenID Connect configuration (will be populated from discovery endpoint)
let oidcConfig: {
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  userinfo_endpoint: string | null;
  issuer?: string;
  jwks_uri?: string;
} = {
  authorization_endpoint: null,
  token_endpoint: null,
  userinfo_endpoint: null,
};

const IDPORTEN_DISCOVERY_URL =
  process.env.IDPORTEN_DISCOVERY_URL ||
  "https://test.idporten.no/.well-known/openid-configuration";

// Function to fetch OpenID Connect configuration from discovery endpoint
export async function fetchOidcConfig() {
  if (
    oidcConfig.authorization_endpoint &&
    oidcConfig.token_endpoint &&
    oidcConfig.userinfo_endpoint
  ) {
    return oidcConfig; // Already fetched
  }

  try {
    console.log(
      `Fetching OpenID Connect configuration from ${IDPORTEN_DISCOVERY_URL}`,
    );
    const response = await axios.get(IDPORTEN_DISCOVERY_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    oidcConfig = {
      authorization_endpoint: response.data.authorization_endpoint,
      token_endpoint: response.data.token_endpoint,
      userinfo_endpoint: response.data.userinfo_endpoint,
      issuer: response.data.issuer,
      jwks_uri: response.data.jwks_uri,
    };

    console.log("OpenID Connect configuration loaded successfully");
    console.log(
      `  Authorization endpoint: ${oidcConfig.authorization_endpoint}`,
    );
    console.log(`  Token endpoint: ${oidcConfig.token_endpoint}`);
    console.log(`  Userinfo endpoint: ${oidcConfig.userinfo_endpoint}`);

    // Log the discovery request
    logRequest(
      "outgoing",
      IDPORTEN_DISCOVERY_URL,
      "GET",
      {},
      null,
      response.data,
      response.status,
      new Date().toISOString(),
    );

    return oidcConfig;
  } catch (error: any) {
    console.error(
      "Error fetching OpenID Connect configuration:",
      error.message,
    );
    if (error.response) {
      logRequest(
        "outgoing",
        IDPORTEN_DISCOVERY_URL,
        "GET",
        {},
        null,
        error.response.data || { error: error.message },
        error.response.status,
        new Date().toISOString(),
      );
    }
    throw error;
  }
}

// Initialize OIDC configuration on module load
fetchOidcConfig().catch((err) => {
  console.error(
    "Failed to fetch OIDC configuration on startup. Will retry on first use.",
  );
  console.error(err.message);
});

// Helper function to generate PKCE code_verifier and code_challenge
export function generatePKCE() {
  // Generate a random code_verifier (43-128 characters, URL-safe)
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  // Generate code_challenge by SHA256 hashing the verifier and base64url encoding
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
  };
}

// Helper function to make logged API calls
export async function makeLoggedRequest(config: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, any>;
}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    logRequest(
      "outgoing",
      config.url,
      config.method || "GET",
      config.headers || {},
      config.data,
      undefined,
      undefined,
      timestamp,
    );

    const response = await axios(config);

    logRequest(
      "outgoing",
      config.url,
      config.method || "GET",
      config.headers || {},
      config.data,
      response.data,
      response.status,
      timestamp,
    );

    return response;
  } catch (error: any) {
    logRequest(
      "outgoing",
      config.url,
      config.method || "GET",
      config.headers || {},
      config.data,
      error.response?.data || { error: error.message },
      error.response?.status || 500,
      timestamp,
    );
    throw error;
  }
}

// Decode ID token and extract claims
export function decodeIdToken(idToken: string) {
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    return decoded?.payload || null;
  } catch (err) {
    console.error("Error decoding ID token:", err);
    return null;
  }
}

