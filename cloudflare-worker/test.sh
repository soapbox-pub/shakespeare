#!/bin/bash

# Test script for Shakespeare Iframe Proxy
# This script helps verify that your Cloudflare Worker setup is working

echo "🧪 Shakespeare Iframe Proxy Test"
echo "================================"

# Get current IFRAME_DOMAIN from .env
if [ -f "../.env" ]; then
    IFRAME_DOMAIN=$(grep VITE_IFRAME_DOMAIN ../.env | cut -d'=' -f2)
else
    echo "❌ .env file not found. Please run setup first."
    exit 1
fi

if [ -z "$IFRAME_DOMAIN" ]; then
    echo "❌ VITE_IFRAME_DOMAIN not set in .env file."
    exit 1
fi

echo "📡 Testing iframe domain: ${IFRAME_DOMAIN}"
echo ""

# Test 1: Basic connectivity
echo "Test 1: Basic connectivity"
echo "--------------------------"
TEST_URL="https://${IFRAME_DOMAIN}"
echo "🔗 Testing: ${TEST_URL}"

if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TEST_URL}" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Successfully connected (HTTP 200)"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "❌ Connection failed - check domain and network"
    else
        echo "⚠️  Connected but got HTTP ${HTTP_CODE}"
    fi
else
    echo "❌ curl not available. Please install curl to run tests."
fi

echo ""

# Test 2: CORS headers
echo "Test 2: CORS Headers"
echo "--------------------"
if command -v curl &> /dev/null; then
    CORS_HEADER=$(curl -s -I "${TEST_URL}" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
    
    if [ -n "$CORS_HEADER" ]; then
        echo "✅ CORS headers present:"
        echo "   ${CORS_HEADER}"
    else
        echo "❌ No CORS headers found"
    fi
else
    echo "❌ curl not available. Skip CORS test."
fi

echo ""

# Test 3: X-Frame-Options (should be absent)
echo "Test 3: X-Frame-Options Check"
echo "------------------------------"
if command -v curl &> /dev/null; then
    X_FRAME_HEADER=$(curl -s -I "${TEST_URL}" 2>/dev/null | grep -i "x-frame-options" || echo "")
    
    if [ -z "$X_FRAME_HEADER" ]; then
        echo "✅ X-Frame-Options header correctly removed"
    else
        echo "❌ X-Frame-Options header still present:"
        echo "   ${X_FRAME_HEADER}"
    fi
else
    echo "❌ curl not available. Skip X-Frame-Options test."
fi

echo ""

# Test 4: Content-Type for JavaScript
echo "Test 4: JavaScript Content-Type"
echo "-------------------------------"
JS_URL="https://${IFRAME_DOMAIN}/_iframe-client.js"

if command -v curl &> /dev/null; then
    CONTENT_TYPE=$(curl -s -I "${JS_URL}" 2>/dev/null | grep -i "content-type" || echo "")
    
    if [[ $CONTENT_TYPE == *"application/javascript"* ]]; then
        echo "✅ JavaScript files have correct Content-Type"
        echo "   ${CONTENT_TYPE}"
    else
        echo "❌ JavaScript Content-Type may be incorrect:"
        echo "   ${CONTENT_TYPE}"
    fi
else
    echo "❌ curl not available. Skip Content-Type test."
fi

echo ""

# Test 5: Service Worker
echo "Test 5: Service Worker Accessibility"
echo "-----------------------------------"
SW_URL="https://${IFRAME_DOMAIN}/sw.js"

if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SW_URL}" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Service Worker accessible (HTTP 200)"
    else
        echo "❌ Service Worker not accessible (HTTP ${HTTP_CODE})"
    fi
else
    echo "❌ curl not available. Skip Service Worker test."
fi

echo ""
echo "🎯 Next Steps"
echo "============="
echo "If all tests pass, your setup should be working!"
echo ""
echo "To test in Shakespeare:"
echo "1. cd .."
echo "2. npm run dev"
echo "3. Open a project in Shakespeare"
echo "4. Build the project"
echo "5. Switch to preview tab"
echo "6. Check browser console for any errors"
echo ""
echo "If you encounter issues:"
echo "- Check browser console for CORS errors"
echo "- Check Network tab for failed requests"
echo "- Verify Cloudflare Worker logs in dashboard"
echo "- Ensure .env has correct IFRAME_DOMAIN"