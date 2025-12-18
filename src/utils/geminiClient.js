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
 * Generate content with automatic fallback to next API key on errors
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} controllerName - Name of the controller for logging
 * @returns {Promise<Object>} - The response from Gemini
 */
async function generateContentWithFallback(prompt, controllerName = 'UNKNOWN') {
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
    
    try {
      console.log(`[${controllerName}] Attempting with API key ${keyIndex}${isFallback ? ' (fallback)' : ' (primary)'}`);
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: gemini_flash });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      if (isFallback) {
        console.log(`[${controllerName}] Successfully used fallback API key ${keyIndex}`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error;
      
      console.error(`[${controllerName}] API key ${keyIndex} failed:`, {
        errorMessage: error.message,
        errorCode: error.code,
        hasMoreKeys: i < apiKeys.length - 1
      });
      
      // If we have more keys, try the next one
      if (i < apiKeys.length - 1) {
        console.log(`[${controllerName}] API key ${keyIndex} failed, trying fallback API key ${keyIndex + 1}...`);
        continue;
      }
      
      // If it's the last key, normalize and throw the error
      if (!(error instanceof AppError)) {
        throw new AppError(
          ERROR_CODES.AI_SERVICE_ERROR,
          error.message || 'AI service error occurred',
          502
        );
      }
      throw error;
    }
  }
  
  // If we've exhausted all keys, throw the last error
  if (lastError) {
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

