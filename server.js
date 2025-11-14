import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// OAuth Configuration
const CLIENT_ID = process.env.CLIENT_ID || "demo-client-id";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "demo-client-secret";
const IDPORTEN_DISCOVERY_URL =
	process.env.IDPORTEN_DISCOVERY_URL ||
	"https://test.idporten.no/.well-known/openid-configuration";
const ALTINN_PLATFORM_URL =
	process.env.ALTINN_PLATFORM_URL || "https://platform.altinn.no";
const ALTINN_ORG = process.env.ALTINN_ORG || "";
const ALTINN_APP_NAME = process.env.ALTINN_APP_NAME || "";
const ALTINN_APP_API_URL =
	ALTINN_ORG && ALTINN_APP_NAME
		? `https://${ALTINN_ORG}.apps.altinn.no/${ALTINN_ORG}/${ALTINN_APP_NAME}`
		: null;
const OAUTH_SCOPES =
	process.env.OAUTH_SCOPES || "openid profile altinn:instances.read";

// OpenID Connect configuration (will be populated from discovery endpoint)
let oidcConfig = {
	authorization_endpoint: null,
	token_endpoint: null,
	userinfo_endpoint: null,
};

// In-memory storage for logs (in production, use a database)
const requestLogs = [];
const MAX_LOGS = 1000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
	session({
		secret:
			process.env.SESSION_SECRET || "altinn-demo-secret-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
	}),
);

// Serve static files
app.use(express.static(join(__dirname, "public")));

// Helper function to log requests
function logRequest(
	type,
	url,
	method,
	headers,
	body,
	response,
	status,
	timestamp,
) {
	const logEntry = {
		id: requestLogs.length + 1,
		type, // 'outgoing' or 'incoming'
		timestamp: timestamp || new Date().toISOString(),
		method: method || "GET",
		url,
		headers: headers ? JSON.parse(JSON.stringify(headers)) : {},
		requestBody: body,
		responseBody: response,
		statusCode: status,
		duration:
			Date.now() - (timestamp ? new Date(timestamp).getTime() : Date.now()),
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

// Function to fetch OpenID Connect configuration from discovery endpoint
async function fetchOidcConfig() {
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
	} catch (error) {
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

// Initialize OIDC configuration on startup
fetchOidcConfig().catch((err) => {
	console.error(
		"Failed to fetch OIDC configuration on startup. Will retry on first use.",
	);
	console.error(err.message);
});

// Helper function to generate PKCE code_verifier and code_challenge
function generatePKCE() {
	// Generate a random code_verifier (43-128 characters, URL-safe)
	// Using 96 characters (32 bytes * 3/2 base64 encoding) for good entropy
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
async function makeLoggedRequest(config) {
	const startTime = Date.now();
	const timestamp = new Date().toISOString();

	try {
		logRequest(
			"outgoing",
			config.url,
			config.method || "GET",
			config.headers,
			config.data,
			null,
			null,
			timestamp,
		);

		const response = await axios(config);

		const duration = Date.now() - startTime;
		logRequest(
			"outgoing",
			config.url,
			config.method || "GET",
			config.headers,
			config.data,
			response.data,
			response.status,
			timestamp,
		);

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;
		logRequest(
			"outgoing",
			config.url,
			config.method || "GET",
			config.headers,
			config.data,
			error.response?.data || { error: error.message },
			error.response?.status || 500,
			timestamp,
		);
		throw error;
	}
}

// Routes

// Get logs
app.get("/api/logs", (req, res) => {
	res.json(requestLogs);
});

// Clear logs
app.post("/api/logs/clear", (req, res) => {
	requestLogs.length = 0;
	res.json({ message: "Logs cleared" });
});

// Login - redirect to ID-porten
app.get("/auth/login", async (req, res) => {
	try {
		// Ensure OIDC configuration is loaded
		const config = await fetchOidcConfig();

		if (!config.authorization_endpoint) {
			return res.status(500).json({
				error: "OpenID Connect configuration not available. Check server logs.",
			});
		}

		// Generate PKCE values
		const { codeVerifier, codeChallenge } = generatePKCE();

		const state = Math.random().toString(36).substring(7);
		const nonce = Math.random().toString(36).substring(7);

		// Store OAuth state, nonce, and PKCE verifier in session
		req.session.oauthState = state;
		req.session.oauthNonce = nonce;
		req.session.codeVerifier = codeVerifier;

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

		// Add RAR authorization_details if configured (for Ansattporten)
		// See: https://docs.digdir.no/docs/ansattporten/ansattporten_rar.html
		// NOTE: RAR is only supported by Ansattporten, not ID-porten
		const rarAuthorizationDetails = process.env.RAR_AUTHORIZATION_DETAILS;
		if (rarAuthorizationDetails) {
			try {
				// Parse JSON and add as URL-encoded parameter
				const rarDetails = JSON.parse(rarAuthorizationDetails);
				params.append("authorization_details", JSON.stringify(rarDetails));
				console.log(
					"Including RAR authorization_details in authorization request:",
					JSON.stringify(rarDetails, null, 2),
				);
			} catch (err) {
				console.error("Error parsing RAR_AUTHORIZATION_DETAILS:", err.message);
			}
		} else {
			console.log(
				"RAR_AUTHORIZATION_DETAILS not configured. RAR authorization_details will not be requested.",
			);
			console.log(
				"To enable RAR, set RAR_AUTHORIZATION_DETAILS in your .env file.",
			);
			console.log(
				"Note: RAR is only supported by Ansattporten, not ID-porten.",
			);
		}

		const authUrl = `${config.authorization_endpoint}?${params.toString()}`;

		logRequest(
			"outgoing",
			authUrl,
			"GET",
			{},
			null,
			null,
			null,
			new Date().toISOString(),
		);

		res.redirect(authUrl);
	} catch (error) {
		console.error("Error in /auth/login:", error.message);
		res.status(500).json({
			error: "Failed to initialize authentication. Please check server logs.",
		});
	}
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
	const { code, state, error } = req.query;

	// Log incoming callback
	logRequest(
		"incoming",
		req.originalUrl,
		"GET",
		req.headers,
		null,
		{ code: code ? "[CODE_RECEIVED]" : null, state, error },
		null,
		new Date().toISOString(),
	);

	if (error) {
		return res.redirect(`/?error=${encodeURIComponent(error)}`);
	}

	if (state !== req.session.oauthState) {
		return res.redirect("/?error=invalid_state");
	}

	if (!code) {
		return res.redirect("/?error=no_code");
	}

	// Verify PKCE code_verifier is in session
	if (!req.session.codeVerifier) {
		return res.redirect("/?error=missing_pkce_verifier");
	}

	try {
		// Ensure OIDC configuration is loaded
		const config = await fetchOidcConfig();

		if (!config.token_endpoint) {
			return res.redirect("/?error=oidc_config_not_available");
		}

		// Exchange authorization code for access token (with PKCE)
		// Use HTTP Basic Auth for client authentication (required by ID-porten)
		const tokenParams = new URLSearchParams({
			grant_type: "authorization_code",
			code: code,
			redirect_uri: `${BASE_URL}/auth/callback`,
			code_verifier: req.session.codeVerifier,
		});

		// Create Basic Auth header: base64(client_id:client_secret)
		const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
			"base64",
		);

		const tokenResponse = await makeLoggedRequest({
			method: "POST",
			url: config.token_endpoint,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${basicAuth}`,
			},
			data: tokenParams.toString(),
		});

		// Clear PKCE verifier from session after successful token exchange
		delete req.session.codeVerifier;

		const { access_token, refresh_token, id_token, expires_in } =
			tokenResponse.data;

		// Store tokens in session
		req.session.accessToken = access_token;
		req.session.refreshToken = refresh_token;
		req.session.idToken = id_token;
		req.session.tokenExpiresAt = Date.now() + expires_in * 1000;

		// Decode ID token to extract claims including RAR authorization_details
		let idTokenClaims = null;
		let authorizationDetails = null;

		// Log the full token response for debugging
		console.log("Token response keys:", Object.keys(tokenResponse.data || {}));
		if (tokenResponse.data) {
			console.log(
				"Token response contains authorization_details:",
				!!tokenResponse.data.authorization_details,
			);
		}

		if (id_token) {
			try {
				// Decode without verification (we're just reading the payload)
				// In production, you should verify the token signature
				const decoded = jwt.decode(id_token, { complete: true });
				if (decoded?.payload) {
					idTokenClaims = decoded.payload;
					console.log("ID token claims keys:", Object.keys(decoded.payload));

					// Check for authorization_details in ID token
					if (decoded.payload?.authorization_details) {
						authorizationDetails = decoded.payload.authorization_details;
						console.log(
							"Found RAR authorization_details in ID token:",
							JSON.stringify(authorizationDetails, null, 2),
						);
					} else {
						console.log("No authorization_details found in ID token payload");
					}
				}
			} catch (err) {
				console.error("Error decoding ID token:", err.message);
			}
		} else {
			console.log("No ID token received");
		}

		// Check access token for authorization_details (some providers include it here)
		if (access_token && !authorizationDetails) {
			try {
				const decodedAccess = jwt.decode(access_token, { complete: true });
				if (decodedAccess?.payload) {
					console.log(
						"Access token claims keys:",
						Object.keys(decodedAccess.payload),
					);
					if (decodedAccess.payload?.authorization_details) {
						authorizationDetails = decodedAccess.payload.authorization_details;
						console.log(
							"Found RAR authorization_details in access token:",
							JSON.stringify(authorizationDetails, null, 2),
						);
					}
				}
			} catch (err) {
				console.error("Error decoding access token:", err.message);
			}
		}

		// Also check token response for authorization_details (some providers include it here)
		if (tokenResponse.data?.authorization_details && !authorizationDetails) {
			authorizationDetails = tokenResponse.data.authorization_details;
			console.log(
				"Found authorization_details in token response:",
				JSON.stringify(authorizationDetails, null, 2),
			);
		}

		if (!authorizationDetails) {
			console.log(
				"WARNING: No authorization_details found in ID token, access token, or token response",
			);
			console.log("This might be because:");
			console.log(
				"1. RAR_AUTHORIZATION_DETAILS was not set in the authorization request",
			);
			console.log(
				"2. The provider does not support RAR or did not return authorization_details",
			);
			console.log(
				"3. The user did not complete the organization selection flow",
			);
		}

		// Store decoded token information
		req.session.idTokenClaims = idTokenClaims;
		req.session.authorizationDetails = authorizationDetails;

		// Get user info - ensure this happens after successful token exchange
		if (config.userinfo_endpoint) {
			try {
				console.log("Fetching user info from:", config.userinfo_endpoint);
				const userInfoResponse = await makeLoggedRequest({
					method: "GET",
					url: config.userinfo_endpoint,
					headers: {
						Authorization: `Bearer ${access_token}`,
						Accept: "application/json",
					},
				});

				req.session.userInfo = userInfoResponse.data;
				console.log("User info successfully fetched and stored in session");
			} catch (err) {
				console.error("Error fetching user info:", err.message);
				if (err.response) {
					console.error(
						"User info error response:",
						err.response.status,
						err.response.data,
					);
				}
				// Continue with login even if userinfo fetch fails
				// User can still use the app, but userinfo won't be available
			}
		} else {
			console.warn("Userinfo endpoint not available in OIDC configuration");
		}

		res.redirect("/?success=true");
	} catch (error) {
		console.error(
			"Token exchange error:",
			error.response?.data || error.message,
		);
		res.redirect(
			`/?error=${encodeURIComponent(error.response?.data?.error || "token_exchange_failed")}`,
		);
	}
});

// Get current user session
app.get("/api/user", (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	res.json({
		authenticated: true,
		userInfo: req.session.userInfo || null,
		tokenExpiresAt: req.session.tokenExpiresAt,
		// RAR (Rich Authorization Requests) data from Ansattporten
		authorizationDetails: req.session.authorizationDetails || null,
		idTokenClaims: req.session.idTokenClaims || null,
	});
});

// ============================================
// Platform API Endpoints
// ============================================

// Profile API - Get user profile
app.get("/api/platform/profile", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	try {
		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_PLATFORM_URL}/profile/api/v1/user`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// Storage API - Get instances (across all apps)
app.get("/api/platform/storage/instances", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	try {
		const params = {};
		if (req.query.instanceOwnerPartyId) {
			params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
		} else if (req.session.userInfo?.pid) {
			params.instanceOwnerPartyId = req.session.userInfo.pid;
		}

		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
			params,
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// Storage API - Get instance by ID
app.get("/api/platform/storage/instances/:instanceId", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	try {
		const { instanceId } = req.params;
		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// Storage API - Get data elements for an instance
app.get(
	"/api/platform/storage/instances/:instanceId/dataelements",
	async (req, res) => {
		if (!req.session.accessToken) {
			return res.status(401).json({ error: "Not authenticated" });
		}

		try {
			const { instanceId } = req.params;
			const response = await makeLoggedRequest({
				method: "GET",
				url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}/dataelements`,
				headers: {
					Authorization: `Bearer ${req.session.accessToken}`,
					Accept: "application/json",
				},
			});

			res.json(response.data);
		} catch (error) {
			res.status(error.response?.status || 500).json({
				error: error.response?.data || error.message,
			});
		}
	},
);

// Storage API - Get instance events
app.get(
	"/api/platform/storage/instances/:instanceId/events",
	async (req, res) => {
		if (!req.session.accessToken) {
			return res.status(401).json({ error: "Not authenticated" });
		}

		try {
			const { instanceId } = req.params;
			const response = await makeLoggedRequest({
				method: "GET",
				url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}/events`,
				headers: {
					Authorization: `Bearer ${req.session.accessToken}`,
					Accept: "application/json",
				},
			});

			res.json(response.data);
		} catch (error) {
			res.status(error.response?.status || 500).json({
				error: error.response?.data || error.message,
			});
		}
	},
);

// ============================================
// App API Endpoints (if configured)
// ============================================

// App API - Get app metadata
app.get("/api/app/metadata", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	if (!ALTINN_APP_API_URL) {
		return res.status(400).json({
			error:
				"App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env",
		});
	}

	try {
		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_APP_API_URL}/metadata`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// App API - Get instances for this app
app.get("/api/app/instances", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	if (!ALTINN_APP_API_URL) {
		return res.status(400).json({
			error:
				"App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env",
		});
	}

	try {
		const params = {};
		if (req.query.instanceOwnerPartyId) {
			params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
		}

		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_APP_API_URL}/instances`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
			params,
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// App API - Create instance
app.post("/api/app/instances", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	if (!ALTINN_APP_API_URL) {
		return res.status(400).json({
			error:
				"App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env",
		});
	}

	try {
		const response = await makeLoggedRequest({
			method: "POST",
			url: `${ALTINN_APP_API_URL}/instances`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			data: req.body,
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// Legacy endpoints for backward compatibility
app.get("/api/altinn/profile", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	try {
		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_PLATFORM_URL}/profile/api/v1/user`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

app.get("/api/altinn/instances", async (req, res) => {
	if (!req.session.accessToken) {
		return res.status(401).json({ error: "Not authenticated" });
	}

	try {
		const params = {};
		if (req.query.instanceOwnerPartyId) {
			params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
		} else if (req.session.userInfo?.pid) {
			params.instanceOwnerPartyId = req.session.userInfo.pid;
		}

		const response = await makeLoggedRequest({
			method: "GET",
			url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances`,
			headers: {
				Authorization: `Bearer ${req.session.accessToken}`,
				Accept: "application/json",
			},
			params,
		});

		res.json(response.data);
	} catch (error) {
		res.status(error.response?.status || 500).json({
			error: error.response?.data || error.message,
		});
	}
});

// Logout - Clear all session data to allow authentication as different user
app.get("/auth/logout", (req, res) => {
	// Get the session cookie name before destroying the session
	const sessionCookieName = req.session?.cookie?.name || "connect.sid";

	// Explicitly clear all session properties before destroying
	// This ensures a clean state for the next authentication
	if (req.session) {
		// Clear OAuth flow data
		delete req.session.oauthState;
		delete req.session.oauthNonce;
		delete req.session.codeVerifier;

		// Clear tokens
		delete req.session.accessToken;
		delete req.session.refreshToken;
		delete req.session.idToken;
		delete req.session.tokenExpiresAt;

		// Clear decoded token data
		delete req.session.idTokenClaims;
		delete req.session.authorizationDetails;

		// Clear user information
		delete req.session.userInfo;

		console.log("Session data cleared for logout");
	}

	// Destroy the session completely
	req.session.destroy((err) => {
		if (err) {
			console.error("Session destroy error:", err);
			// Still redirect even if there's an error
		} else {
			console.log("Session destroyed successfully");
		}
		// Clear the session cookie by setting it to expire immediately
		res.clearCookie(sessionCookieName, {
			path: "/",
			httpOnly: true,
			secure: false, // Set to true in production with HTTPS
		});
		// Redirect with logout parameter to trigger frontend cleanup
		res.redirect("/?logout=true");
	});
});

// Health check
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
	console.log(`Altinn Auth Demo Server running on http://localhost:${PORT}`);
	console.log(`\nOpenID Connect Discovery URL: ${IDPORTEN_DISCOVERY_URL}`);
	console.log(
		`Note: Configure your .env file with actual OAuth credentials (CLIENT_ID, CLIENT_SECRET)`,
	);
	console.log(
		`The application will automatically discover ID-porten endpoints from the discovery URL.\n`,
	);
});
