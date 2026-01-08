// Simple test script to verify Gemini API is working
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { gemini_flash } = require('./src/utils/llms.json');

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API Connection...\n');
  console.log('='.repeat(80));
  
  // Check if API key is configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables');
    console.error('   Please set GEMINI_API_KEY in your .env file');
    process.exit(1);
  }
  
  console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`📋 Model: ${gemini_flash}`);
  console.log('');
  
  try {
    console.log('🔄 Initializing Gemini API client...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: gemini_flash });
    
    console.log('📤 Sending test request to Gemini API...');
    const testPrompt = "Say 'Hello, Gemini API is working!' in exactly 5 words.";
    
    const startTime = Date.now();
    const result = await model.generateContent(testPrompt);
    const duration = Date.now() - startTime;
    
    const response = result.response;
    const text = response.text();
    
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ SUCCESS! Gemini API is working correctly');
    console.log('='.repeat(80));
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📝 Response: ${text}`);
    console.log('');
    console.log('--- Full Response Object ---');
    console.log(JSON.stringify({
      text: text,
      candidates: response.candidates?.map(c => ({
        content: c.content?.parts?.map(p => ({ text: p.text })),
        finishReason: c.finishReason
      })),
      usageMetadata: response.usageMetadata
    }, null, 2));
    console.log('='.repeat(80));
    
    process.exit(0);
    
  } catch (error) {
    console.log('');
    console.log('='.repeat(80));
    console.log('❌ ERROR: Gemini API test failed');
    console.log('='.repeat(80));
    console.log('');
    console.log('--- Error Details ---');
    console.log('Error Type:', error.constructor.name);
    console.log('Error Name:', error.name);
    console.log('Error Message:', error.message);
    console.log('Error Code:', error.code);
    console.log('Error Status:', error.status);
    console.log('');
    
    // Log full error object
    console.log('--- Full Error Object ---');
    try {
      console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.log('Could not stringify error:', e.message);
      console.log('Error object:', error);
    }
    
    // Log stack trace
    if (error.stack) {
      console.log('');
      console.log('--- Stack Trace ---');
      console.log(error.stack);
    }
    
    // Check for common error types
    console.log('');
    console.log('--- Troubleshooting ---');
    if (error.message && error.message.includes('API key')) {
      console.log('⚠️  API Key Issue: Check if your GEMINI_API_KEY is valid');
    }
    if (error.message && error.message.includes('quota')) {
      console.log('⚠️  Quota Issue: You may have exceeded your API quota');
    }
    if (error.message && error.message.includes('429')) {
      console.log('⚠️  Rate Limit: Too many requests, please wait and try again');
    }
    if (error.message && error.message.includes('403')) {
      console.log('⚠️  Permission Issue: API key may not have access to this model');
    }
    
    console.log('='.repeat(80));
    process.exit(1);
  }
}

// Run the test
testGeminiAPI();

