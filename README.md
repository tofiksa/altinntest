# Altinn Authentication Demo

A simple web application that demonstrates Altinn 3 authentication flow using ID-porten, with a visual interface that logs all HTTP requests and responses between the application, Altinn APIs, and authentication providers.

## Features

- **OAuth 2.0 Authentication**: Implements ID-porten OAuth flow for user authentication
- **Request/Response Logging**: Visualizes all HTTP traffic between:
  - Frontend and backend
  - Backend and ID-porten (OAuth provider)
  - Backend and Altinn Platform APIs
- **Real-time Log Viewer**: See authentication flow in real-time with detailed request/response information
- **Altinn API Integration**: Example API calls to Altinn services (Profile, Instances)

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
AUTHORIZATION_URL=https://idporten-ver2.difi.no/idporten-oidc-provider/authorize
TOKEN_URL=https://idporten-ver2.difi.no/idporten-oidc-provider/token
USERINFO_URL=https://idporten-ver2.difi.no/idporten-oidc-provider/userinfo
ALTINN_PLATFORM_URL=https://platform.altinn.no
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
   - Make sure you're using the correct environment (VER2 for testing)
   - For production, use the production endpoints
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
5. Click **"Get Profile"** or **"Get Instances"** to test Altinn API integration

## Architecture

### Backend (Express.js)
- OAuth flow implementation
- Session management
- API request logging middleware
- Proxy for Altinn API calls

### Frontend (Vanilla JS)
- User interface
- Real-time log visualization
- Request interceptors (for frontend logging)
- Auto-refreshing log viewer

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

For more information about Altinn APIs:
- [Altinn API Documentation](https://docs.altinn.studio/nb/api/)
- [Authentication Guide](https://docs.altinn.studio/nb/api/authentication/)
- [ID-porten Integration](https://docs.altinn.studio/dialogporten/user-guides/authenticating/)

## Troubleshooting

- **"Invalid redirect_uri"**: Ensure your redirect URI matches exactly what's registered with Altinn/ID-porten
- **"Invalid client"**: Check your CLIENT_ID and CLIENT_SECRET in `.env`
- **API errors**: Verify you have the correct scopes and API permissions
- **No logs appearing**: Check browser console and server logs for errors

## License

MIT

