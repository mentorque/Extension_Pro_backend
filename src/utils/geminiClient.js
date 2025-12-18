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
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: gemini_flash });
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        if (isFallback || retryAttempt > 0) {
          console.log(`[${controllerName}] Successfully used ${isFallback ? 'fallback ' : ''}API key ${keyIndex}${retryAttempt > 0 ? ` (after ${retryAttempt} retries)` : ''}`);
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        const isRetryable = isRetryableError(error);
        
        console.error(`[${controllerName}] API key ${keyIndex} failed${retryAttempt > 0 ? ` (retry ${retryAttempt})` : ''}:`, {
          errorMessage: error.message,
          errorCode: error.code,
          isRetryable: isRetryable,
          retryAttempt: retryAttempt,
          maxRetries: maxRetries
        });
        
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
  
  // If we've exhausted all keys and retries, throw the last error
  if (lastError) {
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

