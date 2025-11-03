# Altinn Authentication Demo

A simple web application that demonstrates Altinn 3 authentication flow using ID-porten, with a visual interface that logs all HTTP requests and responses between the application, Altinn APIs, and authentication providers.

## Features

- **OAuth 2.0 Authentication**: Implements ID-porten OAuth flow for user authentication
- **Request/Response Logging**: Visualizes all HTTP traffic between:
  - Frontend and backend
  - Backend and ID-porten (OAuth provider)
  - Backend and Altinn Platform APIs
  - Backend and Altinn App APIs
- **Real-time Log Viewer**: See authentication flow in real-time with detailed request/response information
- **Altinn API Integration**: Example API calls to Altinn services following the [Altinn Studio API documentation](https://docs.altinn.studio/nb/api/):
  - **Platform API**: Profile, Storage (instances, data elements, events)
  - **App API**: App metadata, app instances (requires org/appname configuration)

## Prerequisites

- Node.js 18+ 
- An Altinn application registration with:
  - Client ID
  - Client Secret
  - Registered redirect URI

## Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Create a `.env` file in the root directory (copy from `.env.example`):

```env
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here

# ID-porten OpenID Connect Discovery
# The application automatically discovers authorization, token, and userinfo endpoints
IDPORTEN_DISCOVERY_URL=https://test.idporten.no/.well-known/openid-configuration

ALTINN_PLATFORM_URL=https://platform.altinn.no

# Optional: For App API endpoints
# Format: https://{org}.apps.altinn.no/{org}/{appname}
ALTINN_ORG=your-org-name
ALTINN_APP_NAME=your-app-name

PORT=3000
SESSION_SECRET=your-secret-key-change-in-production
BASE_URL=http://localhost:3000
OAUTH_SCOPES=openid profile altinn:instances.read altinn:apps.read
```

3. **Get Client ID and Client Secret**:

   You need to register an API client in ID-porten's Collaboration Portal (Samarbeidsportalen):
   
   **Step-by-step instructions:**
   
   1. **Log in to Samarbeidsportalen**:
      - Go to: [https://integrasjon-ver2.difi.no/](https://integrasjon-ver2.difi.no/)
      - Log in with your ID-porten credentials
   
   2. **Create a new integration**:
      - Click "Opprett ny integrasjon" (Create new integration)
      - Select **Difi-tjeneste**: `API-klient`
      - Configure the integration:
        - **Name**: Choose a descriptive name (e.g., "Altinn Auth Demo")
        - **Scopes**: Add `altinn:enduser` and other scopes you need:
          - `openid`
          - `profile`
          - `altinn:instances.read`
          - `altinn:apps.read`
        - **Redirect URI**: Add `http://localhost:3000/auth/callback`
          - ⚠️ **Important**: The redirect URI must match exactly (including http/https, port, and path)
   
   3. **Save your credentials**:
      - After creating the integration, you'll receive:
        - **Client ID**: A GUID that identifies your client
        - **Client Secret**: A GUID used as the client secret
      - ⚠️ **CRITICAL**: The `client_secret` is only shown once during creation. 
        - Copy it immediately and store it securely
        - If you lose it, you'll need to create a new integration
   
   4. **Additional resources**:
      - [Altinn Documentation - Getting Started](https://altinn.github.io/docs/api/rest/kom-i-gang/tutorial-postman/id-porten-token/)
      - [ID-porten Documentation](https://docs.altinn.studio/dialogporten/user-guides/authenticating/)
   
   **Note for Testing**: 
   - The application uses OpenID Connect discovery to automatically find ID-porten endpoints
   - Default discovery URL: `https://test.idporten.no/.well-known/openid-configuration`
   - For production, change `IDPORTEN_DISCOVERY_URL` to the production discovery endpoint
   - The redirect URI must be registered in the portal before authentication will work

4. **Start the server**:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

5. **Open in browser**:
Navigate to `http://localhost:3000`

## Usage

1. Click **"Login with ID-porten"** to start the authentication flow
2. You will be redirected to ID-porten for authentication
3. After successful login, you'll be redirected back to the application
4. The **Request/Response Logs** section will show:
   - The OAuth authorization request to ID-porten
   - The callback with authorization code
   - Token exchange request
   - User info request
   - Any subsequent Altinn API calls
5. Test Altinn API integration:
   - **Platform API**: Get Profile, Get All Instances
   - **Storage API**: Get Instance by ID, Get Data Elements, Get Instance Events (requires instance ID)
   - **App API**: Get App Metadata, Get App Instances (requires ALTINN_ORG and ALTINN_APP_NAME configuration)

## Architecture

### Backend (Express.js)
- OAuth flow implementation
- Session management
- API request logging middleware
- Proxy for Altinn API calls
- **Platform API endpoints**: `/api/platform/*` (Profile, Storage)
- **App API endpoints**: `/api/app/*` (Metadata, Instances) - requires org/appname config

### Frontend (Vanilla JS)
- User interface with organized API groups
- Real-time log visualization
- Request interceptors (for frontend logging)
- Auto-refreshing log viewer
- Input fields for instance-specific operations

## API Endpoints

### Platform API
The application implements endpoints that match the [Altinn Studio Platform API](https://docs.altinn.studio/nb/api/):

- **Profile API**: `GET /api/platform/profile` → `https://platform.altinn.no/profile/api/v1/user`
- **Storage API**:
  - `GET /api/platform/storage/instances` → Get all instances across apps
  - `GET /api/platform/storage/instances/:instanceId` → Get specific instance
  - `GET /api/platform/storage/instances/:instanceId/dataelements` → Get data elements
  - `GET /api/platform/storage/instances/:instanceId/events` → Get instance events

### App API
App-specific endpoints following the [App API pattern](https://docs.altinn.studio/nb/api/):

- **App Metadata**: `GET /api/app/metadata` → `https://{org}.apps.altinn.no/{org}/{appname}/metadata`
- **App Instances**: 
  - `GET /api/app/instances` → Get instances for the configured app
  - `POST /api/app/instances` → Create a new instance

**Note**: App API endpoints require `ALTINN_ORG` and `ALTINN_APP_NAME` to be configured in `.env`.

## Request/Response Logging

All HTTP requests and responses are logged with:
- Timestamp
- Request method and URL
- Request headers (sensitive data redacted)
- Request body
- Response status code
- Response body
- Request duration

Sensitive information (tokens, cookies) is automatically redacted from logs.

## Security Notes

⚠️ **This is a demo application**. For production use:
- Use HTTPS
- Secure session storage
- Implement proper token refresh
- Add CSRF protection
- Use secure cookies
- Implement rate limiting
- Store logs securely (not in-memory)
- Add proper error handling

## Altinn API Documentation

This application follows the [Altinn Studio API documentation](https://docs.altinn.studio/nb/api/):

- **Main API Documentation**: [Altinn 3 API](https://docs.altinn.studio/nb/api/)
- **Platform API**: Base URL `https://platform.altinn.no` - includes Storage, Profile, Authentication APIs
- **App API**: Pattern `https://{org}.apps.altinn.no/{org}/{appname}` - app-specific endpoints
- **Authentication Guide**: [Authentication API](https://docs.altinn.studio/nb/api/authentication/)
- **ID-porten Integration**: [Dialogporten User Guides](https://docs.altinn.studio/dialogporten/user-guides/authenticating/)
- **Storage API**: [Storage API Documentation](https://docs.altinn.studio/nb/api/storage/)

## Troubleshooting

- **"Invalid redirect_uri"**: Ensure your redirect URI matches exactly what's registered with Altinn/ID-porten
- **"Invalid client"**: Check your CLIENT_ID and CLIENT_SECRET in `.env`
- **API errors**: Verify you have the correct scopes and API permissions
- **No logs appearing**: Check browser console and server logs for errors

## License

MIT

