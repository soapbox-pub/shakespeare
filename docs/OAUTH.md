# Unified OAuth System

Shakespeare implements a unified OAuth 2.0 authentication system that supports multiple providers with a consistent API. This document explains how the system works and how to add new OAuth providers.

## Architecture

The OAuth system consists of three main components:

1. **Generic OAuth Hook** (`useOAuth`) - Core OAuth logic that works with any provider
2. **Provider-Specific Hooks** - Thin wrappers that configure the generic hook for specific providers
3. **OAuth Callback Pages** - React components that handle the OAuth redirect flow

### Current Supported Providers

- **GitHub** - Git repository hosting (with PKCE support)
- **Netlify** - Static site deployment
- **Vercel** - Static site deployment
- **OpenRouter** - AI model routing (with PKCE support)

## File Structure

```
src/
├── hooks/
│   ├── useOAuth.ts              # Generic OAuth hook (core logic)
│   ├── useGitHubOAuth.ts        # GitHub-specific configuration
│   ├── useNetlifyOAuth.ts       # Netlify-specific configuration
│   ├── useVercelOAuth.ts        # Vercel-specific configuration
│   └── useOpenRouterOAuth.ts    # OpenRouter-specific configuration
├── pages/
│   ├── GitHubOAuth.tsx          # GitHub OAuth callback page
│   ├── NetlifyOAuth.tsx         # Netlify OAuth callback page
│   ├── VercelOAuth.tsx          # Vercel OAuth callback page
│   └── OpenRouterOAuth.tsx      # OpenRouter OAuth callback page
└── AppRouter.tsx                # Routes for OAuth callbacks
```

## Environment Variables

OAuth credentials are stored in environment variables and loaded from `process.env`:

```bash
# GitHub OAuth Configuration
VITE_GITHUB_OAUTH_CLIENT_ID="your_github_client_id"
VITE_GITHUB_OAUTH_CLIENT_SECRET="your_github_client_secret"

# Netlify OAuth Configuration
VITE_NETLIFY_OAUTH_CLIENT_ID="your_netlify_client_id"
VITE_NETLIFY_OAUTH_CLIENT_SECRET="your_netlify_client_secret"

# Vercel OAuth Configuration
VITE_VERCEL_OAUTH_CLIENT_ID="your_vercel_client_id"
VITE_VERCEL_OAUTH_CLIENT_SECRET="your_vercel_client_secret"
```

### Security Note

**Client secrets are stored in environment variables** and bundled into the client-side JavaScript. This is necessary because the OAuth flow runs entirely in the browser. While this approach is less secure than a traditional server-side OAuth flow, it's acceptable for this use case because:

1. Shakespeare is a client-side application with no backend
2. The OAuth tokens are scoped to specific permissions
3. Users can revoke tokens at any time from the provider's settings
4. The redirect URIs are validated by the OAuth provider

For production deployments, consider using a serverless function or backend service to handle the token exchange step, keeping client secrets secure.

## How It Works

### 1. Generic OAuth Hook (`useOAuth`)

The `useOAuth` hook implements the OAuth 2.0 authorization code flow with optional PKCE (Proof Key for Code Exchange) support. It accepts a configuration object and returns methods to initiate and handle the OAuth flow.

**Configuration Interface:**

```typescript
interface OAuthConfig {
  provider: 'github' | 'netlify' | 'vercel';  // Provider identifier
  clientId: string;                           // OAuth client ID
  clientSecret: string;                       // OAuth client secret
  authorizeUrl: string;                       // Provider's authorization endpoint
  tokenUrl: string;                           // Provider's token exchange endpoint
  scope?: string;                             // Requested OAuth scopes (optional)
  redirectUri: string;                        // Callback URL after authorization
  usePKCE?: boolean;                          // Enable PKCE (default: false)
  getUserInfo?: (                             // Optional function to fetch user info
    accessToken: string,
    corsProxy: string
  ) => Promise<{
    username: string;
    [key: string]: unknown;
  }>;
}
```

**Returned API:**

```typescript
{
  isLoading: boolean;           // True during token exchange
  error: string | null;         // Error message if OAuth fails
  isOAuthConfigured: boolean;   // True if client ID and secret are set
  initiateOAuth: () => void;    // Start the OAuth flow
  handleCallback: (             // Handle the OAuth callback
    code: string,
    state: string
  ) => Promise<OAuthResult | null>;
}
```

### 2. OAuth Flow Steps

#### Step 1: Initiate OAuth

When the user clicks "Connect to [Provider]", the `initiateOAuth()` function:

1. Generates a random `state` parameter for CSRF protection
2. Optionally generates PKCE parameters (code verifier and challenge)
3. Stores the state and code verifier in localStorage
4. Redirects to the provider's authorization page

```typescript
const { initiateOAuth } = useGitHubOAuth();

// User clicks button
<Button onClick={initiateOAuth}>Connect to GitHub</Button>
```

#### Step 2: User Authorizes

The user is redirected to the provider's authorization page where they:
1. Log in to their account (if not already logged in)
2. Review the requested permissions
3. Approve or deny the authorization request

#### Step 3: OAuth Callback

After authorization, the provider redirects back to the callback URL with:
- `code` - Authorization code
- `state` - The state parameter we sent
- `error` (optional) - Error code if authorization failed
- `error_description` (optional) - Human-readable error description

The callback page (e.g., `GitHubOAuth.tsx`) extracts these parameters and calls `handleCallback()`.

#### Step 4: Token Exchange

The `handleCallback()` function:

1. Verifies the `state` parameter matches what we stored
2. Retrieves the PKCE code verifier (if PKCE is enabled)
3. Exchanges the authorization code for an access token
4. Optionally fetches user information using the access token
5. Returns an `OAuthResult` object with the token and user data

```typescript
interface OAuthResult {
  accessToken: string;      // OAuth access token
  username?: string;        // User's username/email
  scopes?: string[];        // Granted OAuth scopes
  userData?: Record<string, unknown>;  // Additional user data
}
```

#### Step 5: Store Credentials

Provider-specific hooks override `handleCallback` to store the credentials appropriately:

- **GitHub**: Stores in Git settings (for push/pull operations)
- **Netlify/Vercel**: Stores in Deploy settings (for deployment operations)

### 3. PKCE Support

PKCE (Proof Key for Code Exchange) adds an extra layer of security to the OAuth flow by preventing authorization code interception attacks. It's recommended for public clients like browser-based apps.

**How PKCE works:**

1. Generate a random `code_verifier` (cryptographically random string)
2. Create a `code_challenge` by hashing the verifier with SHA-256
3. Send the `code_challenge` during authorization
4. Send the `code_verifier` during token exchange
5. The server verifies that the verifier matches the challenge

**Enabling PKCE:**

```typescript
const config: OAuthConfig = {
  // ... other config
  usePKCE: true,  // Enable PKCE
};
```

**Provider Support:**
- ✅ GitHub - Supports PKCE (enabled)
- ❌ Netlify - Doesn't support PKCE (disabled)
- ❌ Vercel - Doesn't support PKCE (disabled)
- ✅ OpenRouter - Requires PKCE (enabled)

### Scope Parameter

The `scope` parameter is optional in the OAuth configuration. Some providers (like Netlify) don't use scopes in the authorization request - instead, permissions are configured when you create the OAuth application in the provider's settings.

**Provider Scope Usage:**
- ✅ GitHub - Uses scopes (e.g., `repo workflow`)
- ❌ Netlify - No scope parameter (permissions set in app settings)
- ✅ Vercel - Uses scopes (e.g., `deployments:write projects:read`)
- ❌ OpenRouter - No scope parameter (uses PKCE for authorization)

### OpenRouter Custom OAuth Implementation

OpenRouter uses a custom OAuth flow that differs from the standard OAuth 2.0 specification. Instead of using the generic `useOAuth` hook, it has a dedicated `useOpenRouterOAuth` hook with the following key differences:

1. **No Client Credentials**: OpenRouter doesn't require client ID or client secret - it uses PKCE only
2. **Authorization URL**: Uses `callback_url` parameter instead of `redirect_uri`
3. **Token Exchange**: Posts to `/api/v1/auth/keys` with a simplified request body
4. **Response Format**: Returns `{ key }` instead of standard `{ access_token }`
5. **PKCE Required**: Must use PKCE with S256 code challenge method
6. **No User Info**: Doesn't provide a user info endpoint after authentication
7. **No Environment Variables**: No configuration needed - works out of the box

**Authorization URL Format:**
```
https://openrouter.ai/auth?callback_url=<REDIRECT_URI>&code_challenge=<CHALLENGE>&code_challenge_method=S256
```

**Token Exchange Request:**
```json
{
  "code": "<CODE_FROM_QUERY_PARAM>",
  "code_verifier": "<CODE_VERIFIER>",
  "code_challenge_method": "S256"
}
```

**Token Exchange Response:**
```json
{
  "key": "sk-or-v1-..."
}
```

This custom implementation is fully contained in `useOpenRouterOAuth.ts` and doesn't rely on the generic OAuth hook. Unlike other providers, OpenRouter's OAuth doesn't require any environment variables or application registration - it works immediately without configuration.

## Adding a New OAuth Provider

To add a new OAuth provider, follow these steps:

### 1. Add Environment Variables

Add the client ID and secret to `.env.example`:

```bash
# NewProvider OAuth Configuration
VITE_NEWPROVIDER_OAUTH_CLIENT_ID="********************"
VITE_NEWPROVIDER_OAUTH_CLIENT_SECRET="****************************************"
```

### 2. Create Provider-Specific Hook

Create a new file `src/hooks/useNewProviderOAuth.ts`:

```typescript
import { useCallback } from 'react';
import { useOAuth, type OAuthConfig, type OAuthResult } from './useOAuth';
import { proxyUrl } from '@/lib/proxyUrl';

interface NewProviderUserInfo {
  id: string;
  email: string;
  // ... other user fields
}

export function useNewProviderOAuth() {
  // Get the context where you want to store credentials
  // e.g., useDeploySettings() or useGitSettings()
  const { setProviders, settings } = useDeploySettings();

  const config: OAuthConfig = {
    provider: 'newprovider',
    clientId: import.meta.env.VITE_NEWPROVIDER_OAUTH_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_NEWPROVIDER_OAUTH_CLIENT_SECRET || '',
    authorizeUrl: 'https://provider.com/oauth/authorize',
    tokenUrl: 'https://provider.com/oauth/token',
    scope: 'read write', // Optional - omit if provider doesn't use scopes
    redirectUri: window.location.origin + '/oauth/newprovider',
    usePKCE: false, // Set to true if provider supports PKCE
    getUserInfo: async (accessToken: string, corsProxy: string) => {
      const userUrl = proxyUrl(corsProxy, 'https://api.provider.com/user');
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to verify token: ${userResponse.statusText}`);
      }

      const userData: NewProviderUserInfo = await userResponse.json();
      return {
        username: userData.email,
        ...userData,
      };
    },
  };

  const oauth = useOAuth(config);

  const handleCallbackAndStore = useCallback(async (
    code: string,
    state: string
  ): Promise<boolean> => {
    const result: OAuthResult | null = await oauth.handleCallback(code, state);

    if (!result) {
      return false;
    }

    // Store the credentials in the appropriate context
    // This will vary based on what the provider is used for
    const newProvider = {
      id: crypto.randomUUID(),
      name: result.username ? `NewProvider (${result.username})` : 'NewProvider',
      type: 'newprovider',
      apiKey: result.accessToken,
      proxy: true,
    };

    setProviders([...settings.providers, newProvider]);
    return true;
  }, [oauth, setProviders, settings.providers]);

  return {
    ...oauth,
    handleCallback: handleCallbackAndStore,
  };
}
```

### 3. Create OAuth Callback Page

Create a new file `src/pages/NewProviderOAuth.tsx`:

```typescript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNewProviderOAuth } from '@/hooks/useNewProviderOAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';

export default function NewProviderOAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useNewProviderOAuth();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const storedState = localStorage.getItem('newprovider_oauth_state');

    if (error) {
      toast({
        title: "NewProvider OAuth Error",
        description: errorDescription || error,
        variant: "destructive",
      });
      navigate('/settings/deploy'); // or appropriate settings page
      return;
    }

    if (code && state && storedState) {
      handleCallback(code, state).then((success) => {
        if (success) {
          toast({
            title: "NewProvider Connected",
            description: "Successfully connected to NewProvider.",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to NewProvider. Please try again.",
            variant: "destructive",
          });
        }
        navigate('/settings/deploy'); // or appropriate settings page
      });
    } else {
      navigate('/settings/deploy');
    }
  }, [searchParams, handleCallback, toast, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 px-8 text-center">
          <div className="space-y-6">
            {/* Provider logo/icon */}
            <div className="flex justify-center">
              <svg className="h-12 w-12 text-primary" viewBox="0 0 24 24">
                {/* Provider icon SVG */}
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Connecting to NewProvider</h1>
              <p className="text-muted-foreground">
                Processing your NewProvider authentication...
              </p>
            </div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Add Route

Add the OAuth callback route to `src/AppRouter.tsx`:

```typescript
import NewProviderOAuth from "./pages/NewProviderOAuth";

// ...

<Route path="/oauth/newprovider" element={<NewProviderOAuth />} />
```

### 5. Add to UI

Add the provider to the appropriate settings page (e.g., `DeploySettings.tsx`):

```typescript
import { useNewProviderOAuth } from '@/hooks/useNewProviderOAuth';

// In component:
const newProviderOAuth = useNewProviderOAuth();

// In PRESET_PROVIDERS array:
{
  id: 'newprovider',
  type: 'newprovider',
  name: 'NewProvider',
  description: 'Deploy to NewProvider',
  apiKeyLabel: 'Access Token',
  apiKeyURL: 'https://provider.com/settings/tokens',
  proxy: true,
}

// In the render logic, add the OAuth hook to the switch:
const oauthHook = preset.type === 'netlify' ? netlifyOAuth :
                 preset.type === 'vercel' ? vercelOAuth :
                 preset.type === 'newprovider' ? newProviderOAuth : null;
```

### 6. Register OAuth Application

Register your OAuth application with the provider:

1. Go to the provider's developer settings
2. Create a new OAuth application
3. Set the **redirect URI** to: `https://yourdomain.com/oauth/newprovider`
4. Note the **client ID** and **client secret**
5. Add them to your `.env` file

## Testing OAuth Flow

To test the OAuth flow locally:

1. **Set up a tunnel** (e.g., ngrok, cloudflared) to expose localhost:
   ```bash
   npx cloudflared tunnel --url http://localhost:5173
   ```

2. **Register OAuth app** with the tunnel URL as the redirect URI:
   ```
   https://your-tunnel-url.trycloudflare.com/oauth/provider
   ```

3. **Add credentials** to `.env`:
   ```bash
   VITE_PROVIDER_OAUTH_CLIENT_ID="your_client_id"
   VITE_PROVIDER_OAUTH_CLIENT_SECRET="your_client_secret"
   ```

4. **Start the dev server**:
   ```bash
   npm run dev
   ```

5. **Test the flow** by clicking the "Connect to Provider" button

## Error Handling

The OAuth system handles several types of errors:

### User Denies Authorization

If the user denies authorization, the provider redirects with an `error` parameter:
```
/oauth/provider?error=access_denied&error_description=User+denied+access
```

The callback page displays an error toast and redirects to settings.

### Invalid State Parameter

If the `state` parameter doesn't match what we stored (CSRF attack), the flow is aborted and an error is shown.

### Token Exchange Failure

If the token exchange fails (invalid code, expired, etc.), an error is logged and shown to the user.

### Missing PKCE Verifier

If PKCE is enabled but the code verifier is missing from localStorage, the flow is aborted.

## Security Considerations

1. **State Parameter**: Always used for CSRF protection
2. **PKCE**: Used when supported by the provider for additional security
3. **HTTPS Only**: OAuth should only be used over HTTPS in production
4. **Token Storage**: Tokens are stored in browser storage (localStorage/IndexedDB)
5. **Token Revocation**: Users can revoke tokens from the provider's settings
6. **Scope Limitation**: Request only the minimum required scopes

## Troubleshooting

### "OAuth client ID not configured"

The environment variables are not set. Check your `.env` file and ensure the variables are prefixed with `VITE_`.

### "Invalid OAuth state parameter"

The state parameter doesn't match. This could be caused by:
- Multiple OAuth flows running simultaneously
- Browser localStorage being cleared mid-flow
- CSRF attack attempt

### "Failed to verify token"

The provider's API rejected the access token. This could be caused by:
- Incorrect API endpoint URL
- Token doesn't have required scopes
- Provider API is down

### Redirect URI Mismatch

The redirect URI in your OAuth app registration must exactly match the URI in your code:
```typescript
redirectUri: window.location.origin + '/oauth/provider'
```

For local development with a tunnel, this would be:
```
https://your-tunnel-url.trycloudflare.com/oauth/provider
```

## Best Practices

1. **Always use PKCE** when the provider supports it
2. **Request minimal scopes** - only what you need
3. **Handle errors gracefully** - show user-friendly error messages
4. **Clear localStorage** on errors to prevent stuck states
5. **Validate tokens** by fetching user info after exchange
6. **Store tokens securely** - use appropriate browser storage APIs
7. **Provide token revocation** - link to provider's token management page
8. **Test error cases** - user denial, network failures, etc.

## Future Improvements

Potential enhancements to the OAuth system:

1. **Token Refresh**: Implement refresh token flow for long-lived sessions
2. **Token Expiry**: Track token expiration and prompt for re-authentication
3. **Multiple Accounts**: Support multiple accounts per provider
4. **Backend Proxy**: Optional backend service for secure token exchange
5. **Device Flow**: Support OAuth device flow for CLI tools
6. **Biometric Auth**: Integrate with WebAuthn for passwordless OAuth
