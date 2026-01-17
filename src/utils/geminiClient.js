// backend/src/utils/geminiClient.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { gemini_flash } = require('./llms.json');
const { AppError, ERROR_CODES } = require('./errors');

/**
 * Get all available Gemini API keys (primary + fallbacks)
 */
function getApiKeys() {
  const keys = [];
  
  // Primary key
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  
  // Fallback keys
  if (process.env.GEMINI_API_KEY_FALLBACK_1) {
    keys.push(process.env.GEMINI_API_KEY_FALLBACK_1);
  }
  
  if (process.env.GEMINI_API_KEY_FALLBACK_2) {
    keys.push(process.env.GEMINI_API_KEY_FALLBACK_2);
  }
  
  return keys;
}

/**
 * Check if error is a retryable error (503, 429, temporary issues)
 * This detects errors from Gemini API like "503 Service Unavailable" and "overloaded"
 */
function isRetryableError(error) {
  if (!error) return false;
  
  const errorMessage = (error.message || '').toLowerCase();
  const errorCode = String(error.code || '');
  const errorStatus = String(error.status || '');
  
  // Check for retryable errors from Gemini API
  // Example: "[GoogleGenerativeAI Error]: ... [503 Service Unavailable] The model is overloaded."
  const isRetryable = (
    errorMessage.includes('503') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('overloaded') ||
    errorMessage.includes('try again later') ||
    errorMessage.includes('temporarily unavailable') ||
    errorStatus === '503' ||
    errorCode === '503' ||
    errorStatus === '429' ||
    errorCode === '429'
  );
  
  return isRetryable;
}

/**
 * Generate content with automatic fallback to next API key and retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} controllerName - Name of the controller for logging
 * @param {number} maxRetries - Maximum number of retries per key (default: 2)
 * @returns {Promise<Object>} - The response from Gemini
 */
async function generateContentWithFallback(prompt, controllerName = 'UNKNOWN', maxRetries = 2) {
  const apiKeys = getApiKeys();
  
  if (apiKeys.length === 0) {
    throw new AppError(
      ERROR_CODES.CONFIGURATION_ERROR,
      'No Gemini API keys configured. Please set GEMINI_API_KEY in environment variables.',
      500
    );
  }
  
  let lastError = null;
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const keyIndex = i + 1;
    const isFallback = i > 0;
    
    // Try this key with retries
    for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
      try {
        if (retryAttempt > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryAttempt - 1) * 1000;
          console.log(`[${controllerName}] Retrying API key ${keyIndex} (attempt ${retryAttempt + 1}/${maxRetries + 1}) after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log(`[${controllerName}] Attempting with API key ${keyIndex}${isFallback ? ' (fallback)' : ' (primary)'}`);
        }
        
        const apiCallStartTime = Date.now();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: gemini_flash });
        
        // Log request details
        const promptLength = prompt.length;
        const promptWordCount = prompt.split(/\s+/).length;
        console.log(`[${controllerName}] 🚀 Sending request to Gemini API...`);
        console.log(`[${controllerName}] 📝 Request Details:`, {
          model: gemini_flash,
          promptLength: promptLength,
          promptWordCount: promptWordCount,
          promptSizeKB: (promptLength / 1024).toFixed(2),
          estimatedTokens: Math.ceil(promptWordCount * 1.3) // Rough estimate: ~1.3 tokens per word
        });
        
        const result = await model.generateContent(prompt);
        const apiCallTime = Date.now() - apiCallStartTime;
        
        const response = result.response;
        const responseText = response.text();
        const responseLength = responseText.length;
        const responseWordCount = responseText.split(/\s+/).length;
        
        // Extract usage metadata
        const usageMetadata = response.usageMetadata || {};
        const promptTokenCount = usageMetadata.promptTokenCount || 'N/A';
        const candidatesTokenCount = usageMetadata.candidatesTokenCount || 'N/A';
        const totalTokenCount = usageMetadata.totalTokenCount || 'N/A';
        
        // Extract candidate details
        const candidates = response.candidates || [];
        const finishReason = candidates[0]?.finishReason || 'N/A';
        const safetyRatings = candidates[0]?.safetyRatings || [];
        
        console.log(`[${controllerName}] ✅ Gemini API responded in ${apiCallTime}ms`);
        console.log(`[${controllerName}] 📊 Response Details:`, {
          responseLength: responseLength,
          responseWordCount: responseWordCount,
          responseSizeKB: (responseLength / 1024).toFixed(2),
          finishReason: finishReason,
          hasSafetyRatings: safetyRatings.length > 0
        });
        console.log(`[${controllerName}] 🎯 Token Usage:`, {
          promptTokens: promptTokenCount,
          candidatesTokens: candidatesTokenCount,
          totalTokens: totalTokenCount,
          tokensPerSecond: totalTokenCount !== 'N/A' ? ((totalTokenCount / apiCallTime) * 1000).toFixed(2) : 'N/A',
          promptTokensPerSecond: promptTokenCount !== 'N/A' ? ((promptTokenCount / apiCallTime) * 1000).toFixed(2) : 'N/A'
        });
        
        if (isFallback || retryAttempt > 0) {
          console.log(`[${controllerName}] Successfully used ${isFallback ? 'fallback ' : ''}API key ${keyIndex}${retryAttempt > 0 ? ` (after ${retryAttempt} retries)` : ''}`);
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        const isRetryable = isRetryableError(error);
        
        // Log the complete raw error object for debugging
        console.error('\n' + '='.repeat(80));
        console.error(`[${controllerName}] GEMINI API ERROR - API Key ${keyIndex}${isFallback ? ' (FALLBACK)' : ' (PRIMARY)'}${retryAttempt > 0 ? ` - RETRY ${retryAttempt}/${maxRetries}` : ''}`);
        console.error('='.repeat(80));
        
        // Log all error properties
        console.error('Error Type:', error.constructor.name);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Status:', error.status);
        console.error('Error Status Code:', error.statusCode);
        
        // Log full error object structure
        console.error('\n--- Full Error Object ---');
        console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        // Log error stack if available
        if (error.stack) {
          console.error('\n--- Error Stack Trace ---');
          console.error(error.stack);
        }
        
        // Log additional properties that might exist
        if (error.cause) {
          console.error('\n--- Error Cause ---');
          console.error(JSON.stringify(error.cause, null, 2));
        }
        
        if (error.response) {
          console.error('\n--- Error Response ---');
          console.error(JSON.stringify(error.response, null, 2));
        }
        
        if (error.config) {
          console.error('\n--- Request Config ---');
          console.error(JSON.stringify(error.config, null, 2));
        }
        
        // Log retry information
        console.error('\n--- Retry Information ---');
        console.error('Is Retryable:', isRetryable);
        console.error('Retry Attempt:', retryAttempt);
        console.error('Max Retries:', maxRetries);
        console.error('API Key Index:', keyIndex);
        console.error('Is Fallback Key:', isFallback);
        console.error('='.repeat(80) + '\n');
        
        // If it's retryable and we haven't exhausted retries, try again
        if (isRetryable && retryAttempt < maxRetries) {
          continue; // Retry this key
        }
        
        // If it's not retryable or we've exhausted retries for this key, move to next key
        if (!isRetryable || retryAttempt >= maxRetries) {
          break; // Move to next API key
        }
      }
    }
    
    // If we have more keys, try the next one
    if (i < apiKeys.length - 1) {
      console.log(`[${controllerName}] API key ${keyIndex} failed, trying fallback API key ${i + 2}...`);
      continue;
    }
  }
  
  // If we've exhausted all keys and retries, log final error and throw
  if (lastError) {
    console.error('\n' + '='.repeat(80));
    console.error(`[${controllerName}] ALL API KEYS EXHAUSTED - FINAL ERROR`);
    console.error('='.repeat(80));
    console.error('Final Error Type:', lastError.constructor.name);
    console.error('Final Error Name:', lastError.name);
    console.error('Final Error Message:', lastError.message);
    console.error('Final Error Code:', lastError.code);
    console.error('Final Error Status:', lastError.status);
    console.error('\n--- Complete Final Error Object ---');
    console.error(JSON.stringify(lastError, Object.getOwnPropertyNames(lastError), 2));
    if (lastError.stack) {
      console.error('\n--- Final Error Stack Trace ---');
      console.error(lastError.stack);
    }
    console.error('='.repeat(80) + '\n');
    
    if (!(lastError instanceof AppError)) {
      // Check if it was a service unavailable error
      const errorMessage = (lastError.message || '').toLowerCase();
      if (errorMessage.includes('overloaded') || errorMessage.includes('service unavailable')) {
        throw new AppError(
          ERROR_CODES.AI_SERVICE_ERROR,
          'AI service is temporarily overloaded. Please try again in a few moments.',
          503
        );
      }
      throw new AppError(
        ERROR_CODES.AI_SERVICE_ERROR,
        lastError.message || 'AI service error occurred',
        502
      );
    }
    throw lastError;
  }
  
  throw new AppError(
    ERROR_CODES.AI_SERVICE_ERROR,
    'All AI API keys failed. Please try again later.',
    502
  );
}

module.exports = {
  generateContentWithFallback,
  getApiKeys
};

