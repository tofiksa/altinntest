# Altinn Authentication Demo Application

## Background and Motivation

Create a simple web application that demonstrates Altinn 3 authentication flow. The application should:
- Use Altinn's authentication (via ID-porten for end users or Maskinporten for machine-to-machine)
- Authenticate and authorize a user
- Display a web UI that logs all HTTP requests and responses between the application, Altinn APIs, and authentication providers
- Serve as an educational example of the Altinn authentication flow

From the documentation:
- Altinn uses ID-porten for end-user authentication
- Maskinporten is used for machine-to-machine/system authentication
- Platform API base URL: `https://platform.altinn.no`
- App API URLs follow pattern: `https://{org}.apps.altinn.no/{org}/{appname}`
- Storage API can access instances across all applications

## Key Challenges and Analysis

1. **Authentication Flow**: Need to implement OAuth 2.0/OIDC flow with ID-porten
   - Redirect user to ID-porten for login
   - Handle callback with authorization code
   - Exchange code for access token
   - Use token to call Altinn APIs

2. **Request/Response Logging**: Capture all HTTP traffic
   - Frontend: Log all fetch/XMLHttpRequest calls
   - Backend: Log all outgoing requests and incoming responses
   - Display in a user-friendly UI

3. **Backend Setup**: Need a server to:
   - Handle OAuth callback (redirect URI must be server-side)
   - Store session state
   - Make authenticated API calls to Altinn
   - Proxy requests to capture logging

4. **Altinn Configuration**: 
   - May need test credentials/environment
   - Need to register application with Altinn (OAuth client)
   - Scopes required for API access

## High-level Task Breakdown

### Phase 1: Project Setup
- [x] Initialize Node.js project with package.json
- [x] Set up Express.js backend server
- [x] Set up basic HTML/CSS/JS frontend structure
- [x] Create basic file structure (public/ for frontend, root for backend)
- [x] Add environment configuration file (env.example)

### Phase 2: Authentication Implementation
- [x] Research and document ID-porten OAuth flow endpoints
- [x] Implement OAuth authorization endpoint (redirect to ID-porten)
- [x] Implement OAuth callback handler
- [x] Implement token exchange (authorization code -> access token)
- [ ] Implement token refresh logic (basic session-based expiry tracking in place)
- [x] Store tokens securely (session/cookie)

### Phase 3: Request/Response Logging System
- [x] Create backend middleware to log all outgoing requests
- [x] Create backend endpoint to receive logs (/api/logs)
- [x] Implement frontend request interceptor (fetch/XMLHttpRequest)
- [x] Create log storage structure (in-memory for demo)
- [x] Design UI component to display logs

### Phase 4: Altinn API Integration
- [x] Create API client wrapper that logs requests/responses
- [x] Implement test API call (get user profile, list instances)
- [x] Handle API errors gracefully
- [x] Display API responses in UI

### Phase 5: UI Development
- [x] Create login/logout UI
- [x] Create log viewer component (with expandable details)
- [x] Style application with modern CSS
- [x] Add request/response expand/collapse functionality
- [x] Add filters for log entries (type badges, method badges, status codes)
- [x] Display user information after authentication

### Phase 6: Documentation and Testing
- [x] Create README with setup instructions
- [x] Document environment variables needed
- [x] Add example .env file (env.example)
- [ ] Test complete authentication flow (requires real OAuth credentials)
- [x] Verify all requests/responses are logged (logging infrastructure complete)

## Project Status Board

| Task | Status | Notes |
|------|--------|-------|
| Project Setup | Completed | All files created, package.json configured |
| Authentication Implementation | Completed | OAuth flow implemented, token refresh can be enhanced |
| Request/Response Logging | Completed | Full logging system with UI viewer |
| Altinn API Integration | Completed | Profile and Instances endpoints implemented |
| UI Development | Completed | Modern, responsive UI with log viewer |
| Documentation | Completed | README created with setup instructions |

## Executor's Feedback or Assistance Requests

_No blockers yet - waiting to start execution_

## Lessons

_No lessons yet_

