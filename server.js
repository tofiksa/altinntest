import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// OAuth Configuration
const CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'demo-client-secret';
const AUTHORIZATION_URL = process.env.AUTHORIZATION_URL || 'https://idporten-ver2.difi.no/idporten-oidc-provider/authorize';
const TOKEN_URL = process.env.TOKEN_URL || 'https://idporten-ver2.difi.no/idporten-oidc-provider/token';
const USERINFO_URL = process.env.USERINFO_URL || 'https://idporten-ver2.difi.no/idporten-oidc-provider/userinfo';
const ALTINN_PLATFORM_URL = process.env.ALTINN_PLATFORM_URL || 'https://platform.altinn.no';
const ALTINN_ORG = process.env.ALTINN_ORG || '';
const ALTINN_APP_NAME = process.env.ALTINN_APP_NAME || '';
const ALTINN_APP_API_URL = ALTINN_ORG && ALTINN_APP_NAME 
  ? `https://${ALTINN_ORG}.apps.altinn.no/${ALTINN_ORG}/${ALTINN_APP_NAME}`
  : null;
const OAUTH_SCOPES = process.env.OAUTH_SCOPES || 'openid profile altinn:instances.read';

// In-memory storage for logs (in production, use a database)
const requestLogs = [];
const MAX_LOGS = 1000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'altinn-demo-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Helper function to log requests
function logRequest(type, url, method, headers, body, response, status, timestamp) {
  const logEntry = {
    id: requestLogs.length + 1,
    type, // 'outgoing' or 'incoming'
    timestamp: timestamp || new Date().toISOString(),
    method: method || 'GET',
    url,
    headers: headers ? JSON.parse(JSON.stringify(headers)) : {},
    requestBody: body,
    responseBody: response,
    statusCode: status,
    duration: Date.now() - (timestamp ? new Date(timestamp).getTime() : Date.now())
  };
  
  // Remove sensitive data from logs
  if (logEntry.headers.authorization) {
    logEntry.headers.authorization = '[REDACTED]';
  }
  if (logEntry.headers.cookie) {
    logEntry.headers.cookie = '[REDACTED]';
  }
  
  requestLogs.unshift(logEntry);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.pop();
  }
  
  return logEntry;
}

// Helper function to make logged API calls
async function makeLoggedRequest(config) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    logRequest('outgoing', config.url, config.method || 'GET', config.headers, config.data, null, null, timestamp);
    
    const response = await axios(config);
    
    const duration = Date.now() - startTime;
    logRequest('outgoing', config.url, config.method || 'GET', config.headers, config.data, response.data, response.status, timestamp);
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('outgoing', config.url, config.method || 'GET', config.headers, config.data, 
      error.response?.data || { error: error.message }, error.response?.status || 500, timestamp);
    throw error;
  }
}

// Routes

// Get logs
app.get('/api/logs', (req, res) => {
  res.json(requestLogs);
});

// Clear logs
app.post('/api/logs/clear', (req, res) => {
  requestLogs.length = 0;
  res.json({ message: 'Logs cleared' });
});

// Login - redirect to ID-porten
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const nonce = Math.random().toString(36).substring(7);
  
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  
  const redirectUri = `${BASE_URL}/auth/callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES,
    state: state,
    nonce: nonce
  });
  
  const authUrl = `${AUTHORIZATION_URL}?${params.toString()}`;
  
  logRequest('outgoing', authUrl, 'GET', {}, null, null, null, new Date().toISOString());
  
  res.redirect(authUrl);
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Log incoming callback
  logRequest('incoming', req.originalUrl, 'GET', req.headers, null, 
    { code: code ? '[CODE_RECEIVED]' : null, state, error }, null, new Date().toISOString());
  
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }
  
  if (state !== req.session.oauthState) {
    return res.redirect('/?error=invalid_state');
  }
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await makeLoggedRequest({
      method: 'POST',
      url: TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${BASE_URL}/auth/callback`,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }).toString()
    });
    
    const { access_token, refresh_token, id_token, expires_in } = tokenResponse.data;
    
    // Store tokens in session
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.idToken = id_token;
    req.session.tokenExpiresAt = Date.now() + (expires_in * 1000);
    
    // Get user info
    try {
      const userInfoResponse = await makeLoggedRequest({
        method: 'GET',
        url: USERINFO_URL,
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      
      req.session.userInfo = userInfoResponse.data;
    } catch (err) {
      console.error('Error fetching user info:', err.message);
    }
    
    res.redirect('/?success=true');
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.redirect(`/?error=${encodeURIComponent(error.response?.data?.error || 'token_exchange_failed')}`);
  }
});

// Get current user session
app.get('/api/user', (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    authenticated: true,
    userInfo: req.session.userInfo || null,
    tokenExpiresAt: req.session.tokenExpiresAt
  });
});

// ============================================
// Platform API Endpoints
// ============================================

// Profile API - Get user profile
app.get('/api/platform/profile', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/profile/api/v1/user`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Storage API - Get instances (across all apps)
app.get('/api/platform/storage/instances', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const params = {};
    if (req.query.instanceOwnerPartyId) {
      params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
    } else if (req.session.userInfo?.pid) {
      params.instanceOwnerPartyId = req.session.userInfo.pid;
    }
    
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      },
      params
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Storage API - Get instance by ID
app.get('/api/platform/storage/instances/:instanceId', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { instanceId } = req.params;
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Storage API - Get data elements for an instance
app.get('/api/platform/storage/instances/:instanceId/dataelements', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { instanceId } = req.params;
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}/dataelements`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Storage API - Get instance events
app.get('/api/platform/storage/instances/:instanceId/events', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { instanceId } = req.params;
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances/${instanceId}/events`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// ============================================
// App API Endpoints (if configured)
// ============================================

// App API - Get app metadata
app.get('/api/app/metadata', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!ALTINN_APP_API_URL) {
    return res.status(400).json({ 
      error: 'App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env' 
    });
  }
  
  try {
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_APP_API_URL}/metadata`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// App API - Get instances for this app
app.get('/api/app/instances', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!ALTINN_APP_API_URL) {
    return res.status(400).json({ 
      error: 'App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env' 
    });
  }
  
  try {
    const params = {};
    if (req.query.instanceOwnerPartyId) {
      params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
    }
    
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_APP_API_URL}/instances`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      },
      params
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// App API - Create instance
app.post('/api/app/instances', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!ALTINN_APP_API_URL) {
    return res.status(400).json({ 
      error: 'App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env' 
    });
  }
  
  try {
    const response = await makeLoggedRequest({
      method: 'POST',
      url: `${ALTINN_APP_API_URL}/instances`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: req.body
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Legacy endpoints for backward compatibility
app.get('/api/altinn/profile', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/profile/api/v1/user`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

app.get('/api/altinn/instances', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const params = {};
    if (req.query.instanceOwnerPartyId) {
      params.instanceOwnerPartyId = req.query.instanceOwnerPartyId;
    } else if (req.session.userInfo?.pid) {
      params.instanceOwnerPartyId = req.session.userInfo.pid;
    }
    
    const response = await makeLoggedRequest({
      method: 'GET',
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances`,
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Accept': 'application/json'
      },
      params
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/');
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Altinn Auth Demo Server running on http://localhost:${PORT}`);
  console.log(`\nNote: Configure your .env file with actual OAuth credentials`);
  console.log(`For testing, the app will use demo endpoints but authentication will fail without real credentials.\n`);
});

