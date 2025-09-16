#!/bin/bash

# Shakespeare Iframe Proxy Setup Script
# This script helps you set up the Cloudflare Worker for iframe proxying

set -e

echo "🚀 Shakespeare Iframe Proxy Setup"
echo "=================================="

# Check if surge is installed
if ! command -v surge &> /dev/null; then
    echo "❌ Surge is not installed. Installing..."
    npm install -g surge
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed. Installing..."
    npm install -g wrangler
fi

# Ask for surge domain
read -p "📦 Enter a unique name for your Surge deployment (e.g., shakespeare-iframe-123): " SURGE_DOMAIN

# Deploy to surge
echo "📤 Deploying iframe-fetch-client to Surge..."
cd ../iframe-fetch-client
surge . "${SURGE_DOMAIN}.surge.sh"
cd ../cloudflare-worker

# Update worker configuration
echo "⚙️  Updating worker configuration..."
sed -i "s/your-unique-name.surge.sh/${SURGE_DOMAIN}.surge.sh/g" worker.js

# Ask for Cloudflare setup
echo ""
echo "🌐 Cloudflare Worker Setup"
echo "------------------------"
echo "Choose your setup method:"
echo "1) Quick setup (via Cloudflare Dashboard - recommended for beginners)"
echo "2) Advanced setup (using Wrangler CLI - recommended for developers)"
read -p "Enter your choice (1 or 2): " SETUP_CHOICE

if [ "$SETUP_CHOICE" = "1" ]; then
    echo ""
    echo "📋 Quick Setup Instructions:"
    echo "============================"
    echo "1. Go to https://dash.cloudflare.com/"
    echo "2. Navigate to Workers & Pages → Create application"
    echo "3. Select 'Create Worker'"
    echo "4. Copy the contents of worker.js into the editor"
    echo "5. Click 'Save and Deploy'"
    echo "6. Note your worker's URL (e.g., shakespeare-iframe-proxy.your-account.workers.dev)"
    echo ""
    read -p "🔗 Enter your worker URL (e.g., shakespeare-iframe-proxy.your-account.workers.dev): " WORKER_URL
    
    # Update environment variable
    echo ""
    echo "🔧 Updating environment configuration..."
    cd ..
    
    # Extract domain from worker URL
    if [[ $WORKER_URL == *workers.dev ]]; then
        IFRAME_DOMAIN=$(echo $WORKER_URL | sed 's|https://||' | sed 's|/.*||')
    else
        echo "❌ Invalid worker URL format. Please enter a valid workers.dev URL."
        exit 1
    fi
    
    sed -i "s/VITE_IFRAME_DOMAIN=.*/VITE_IFRAME_DOMAIN=${IFRAME_DOMAIN}/" .env
    
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run dev (or npm run build)"
    echo "2. Open Shakespeare and test the preview"
    echo "3. Check browser console for any errors"
    
else
    echo ""
    echo "🔧 Advanced Setup with Wrangler"
    echo "================================"
    
    # Check if logged in
    if ! wrangler whoami &> /dev/null; then
        echo "🔐 Logging in to Cloudflare..."
        wrangler login
    fi
    
    # Deploy worker
    echo "📤 Deploying Cloudflare Worker..."
    WORKER_URL=$(wrangler deploy --json | jq -r '.workers_dev.url')
    
    if [ -z "$WORKER_URL" ]; then
        echo "❌ Failed to deploy worker. Please check the error messages above."
        exit 1
    fi
    
    echo "✅ Worker deployed to: $WORKER_URL"
    
    # Update environment variable
    echo ""
    echo "🔧 Updating environment configuration..."
    cd ..
    
    # Extract domain from worker URL
    IFRAME_DOMAIN=$(echo $WORKER_URL | sed 's|https://||' | sed 's|/.*||')
    
    sed -i "s/VITE_IFRAME_DOMAIN=.*/VITE_IFRAME_DOMAIN=${IFRAME_DOMAIN}/" .env
    
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run dev (or npm run build)"
    echo "2. Open Shakespeare and test the preview"
    echo "3. Check browser console for any errors"
    echo ""
    echo "🎉 For production use, consider setting up a custom domain."
    echo "   See cloudflare-worker/README.md for instructions."
fi

echo ""
echo "🧪 Testing Instructions"
echo "======================"
echo "To test your setup:"
echo "1. Start Shakespeare: npm run dev"
echo "2. Create or open a project"
echo "3. Build the project"
echo "4. Switch to preview tab"
echo "5. Open browser console (F12)"
echo "6. Look for successful iframe loading and console messages"
echo ""
echo "If you see any errors, check:"
echo "- Browser console for CORS or security errors"
echo "- Network tab for failed requests"
echo "- Cloudflare Worker logs (in dashboard)"