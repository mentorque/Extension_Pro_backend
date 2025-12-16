#!/bin/bash

# Direct Gemini API Key Test
# Usage: ./test-gemini-direct.sh YOUR_GEMINI_API_KEY

GEMINI_API_KEY="${1}"

if [ -z "$GEMINI_API_KEY" ]; then
  echo "Usage: $0 YOUR_GEMINI_API_KEY"
  echo "Example: $0 AIzaSy..."
  exit 1
fi

echo "Testing Gemini API Key directly..."
echo "=================================="
echo ""

# First, list available models
echo "1. Listing available models..."
echo "----------------------------"
curl -X GET "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -s | jq '.models[] | select(.name | contains("gemini")) | {name: .name, supportedMethods: .supportedGenerationMethods}' | head -20

echo ""
echo ""
echo "2. Testing generateContent with gemini-2.5-flash..."
echo "---------------------------------------------------"

# Try with gemini-2.5-flash (as per your config)
response=$(curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Say hello in one sentence"
      }]
    }]
  }' \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""
echo "HTTP Status: $http_status"

if [ "$http_status" = "200" ]; then
  echo ""
  echo "✅ SUCCESS - Gemini API key is valid!"
else
  echo ""
  echo "❌ FAILED - Trying alternative model names..."
  echo ""
  
  # Try gemini-1.5-flash-latest
  echo "3. Trying gemini-1.5-flash-latest..."
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
    -s | jq '.'
fi

echo ""
echo "Test complete!"
