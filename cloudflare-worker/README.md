# Shakespeare Iframe Proxy - Cloudflare Worker Setup

This Cloudflare Worker acts as a reverse proxy for the Shakespeare iframe-fetch-client, removing restrictive headers and adding CORS support to enable iframe embedding.

## Quick Setup

### Step 1: Deploy iframe-fetch-client to Surge

First, deploy your iframe-fetch-client files to Surge:

```bash
cd ../iframe-fetch-client
npx -y surge . your-unique-name.surge.sh
```

Replace `your-unique-name` with something unique.

### Step 2: Update Worker Configuration

Edit `worker.js` and update the `surgeDomain` variable:

```javascript
// Change this line
const surgeDomain = 'your-unique-name.surge.sh'; // TODO: Update this!
```

Use the same Surge domain you deployed to in Step 1.

### Step 3: Deploy the Cloudflare Worker

#### Option A: Quick Setup (via Dashboard)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages → Create application
3. Select "Create Worker"
4. Copy the contents of `worker.js` into the editor
5. Click "Save and Deploy"
6. Note your worker's URL (e.g., `shakespeare-iframe-proxy.your-account.workers.dev`)

#### Option B: Using Wrangler CLI

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy from this directory:
   ```bash
   cd cloudflare-worker
   wrangler deploy
   ```

### Step 4: Set Up Custom Domain (Optional but Recommended)

#### Using Cloudflare Dashboard:

1. Go to your domain in Cloudflare DNS
2. Create a wildcard CNAME record:
   - Type: `CNAME`
   - Name: `*` (or a specific subdomain like `iframe`)
   - Target: Your worker URL (e.g., `shakespeare-iframe-proxy.your-account.workers.dev`)
   - Proxy status: Enabled (orange cloud)

3. Add a route to your worker:
   - In Workers & Pages, select your worker
   - Go to Settings → Triggers → Routes
   - Add route: `*.your-domain.com/*`

#### Using Wrangler:

Update your `wrangler.toml`:

```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.routes]]
pattern = "*.your-domain.com/*"
zone_name = "your-domain.com"
```

Then deploy:
```bash
wrangler deploy --env production
```

### Step 5: Update Your Environment

Update your `.env` file in the main project:

```bash
# Change from:
VITE_IFRAME_DOMAIN=local-shakespeare.dev

# To (using your custom domain):
VITE_IFRAME_DOMAIN=your-domain.com

# Or (using worker subdomain):
VITE_IFRAME_DOMAIN=your-account.workers.dev
```

### Step 6: Test the Setup

1. Rebuild your main project:
   ```bash
   cd ..
   npm run build
   # Or start development server
   npm run dev
   ```

2. Open Shakespeare and create/load a project
3. Build the project
4. Switch to preview tab
5. Open browser console to see:
   - Successful iframe loading
   - Console messages being forwarded
   - No CORS or security errors

## Local Development

### Test Worker Locally:

```bash
cd cloudflare-worker
wrangler dev --local-port 8787
```

Test with curl:
```bash
curl http://localhost:8787
```

### Test with Local Shakespeare:

Update your `.env` temporarily:
```bash
VITE_IFRAME_DOMAIN=localhost:8787
```

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure CORS headers are properly set in the worker
2. **X-Frame-Options Blocked**: Ensure these headers are removed in the worker
3. **Mixed Content**: Use HTTPS everywhere
4. **Service Worker Registration**: Check MIME types for `.js` files

### Debug Headers:

You can test what headers are being sent/received:

```bash
curl -I https://project123.your-domain.com/
```

### Check Worker Logs:

Use Cloudflare Dashboard to view worker logs and debug requests.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Shakespeare App │    │ Cloudflare      │    │ Surge.sh        │
│ (Parent Window) │    │ Worker Proxy    │    │ (File Hosting) │
│                 │    │                 │    │                 │
│ - PreviewPane   │───▶│ - Remove        │───▶│ - iframe-       │
│ - JSON-RPC      │    │   X-Frame-Opt   │    │   fetch-client  │
│ - Console UI    │    │ - Add CORS      │    │ - sw.js         │
│                 │    │ - Route         │    │ - index.html    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

The worker enables secure iframe embedding by:
1. Removing headers that prevent iframe embedding
2. Adding appropriate CORS headers for cross-origin communication
3. Providing a stable domain for project subdomains
4. Handling SSL/TLS automatically