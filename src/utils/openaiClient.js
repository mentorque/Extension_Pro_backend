// backend/src/utils/openaiClient.js
const OpenAI = require('openai');
const { AppError, ERROR_CODES } = require('./errors');

// Model: GPT-4.1 - Optimized for accuracy, thinking, and strict prompt adherence
const MODEL = 'gpt-4.1';

/**
 * Get OpenAI API key from environment
 */
function getApiKey() {
  const apiKey = process.env.OPEN_AI_KEY;
  if (!apiKey) {
    throw new AppError(
      ERROR_CODES.CONFIGURATION_ERROR,
      'No OpenAI API key configured. Please set OPEN_AI_KEY in environment variables.',
      500
    );
  }
  return apiKey;
}

/**
 * Check if error is retryable (429, 500, 502, 503)
 */
function isRetryableError(error) {
  if (!error) return false;
  
  const status = error.status || error.response?.status || error.code;
  const statusCode = String(status || '');
  
  // Retryable HTTP status codes
  return ['429', '500', '502', '503'].includes(statusCode) ||
         error.message?.toLowerCase().includes('rate limit') ||
         error.message?.toLowerCase().includes('server error') ||
         error.message?.toLowerCase().includes('timeout');
}

/**
 * Generate content with OpenAI API - optimized for accuracy, thinking, and strict prompt adherence
 * Uses GPT-4.1: High-accuracy model with enhanced reasoning capabilities
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {string} controllerName - Name of the controller for logging
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @param {boolean} requiresJson - Whether response should be JSON (default: true)
 * @returns {Promise<Object>} - The response from OpenAI with text() method
 */
async function generateContentWithFallback(prompt, controllerName = 'UNKNOWN', maxRetries = 2, requiresJson = true) {
  const apiKey = getApiKey();
  const client = new OpenAI({ apiKey });
  
  let lastError = null;
  
  for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
    try {
      if (retryAttempt > 0) {
        // Exponential backoff: 500ms, 1000ms
        const delay = Math.pow(2, retryAttempt - 1) * 500;
          // Retrying...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const apiCallStartTime = Date.now();
      
      // Optimized request for accuracy, thinking, and strict prompt adherence
      // GPT-4.1: High-accuracy model with enhanced reasoning capabilities
      // Pass prompt directly (like Gemini did) - no separate system message
      const requestOptions = {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.0, // Deterministic output for maximum accuracy and consistency
        top_p: 0.7, // Focus on most probable tokens for accuracy
        frequency_penalty: 0.3, // Reduce repetition for cleaner output
        presence_penalty: 0.0, // Allow necessary repetition when needed
        max_tokens: requiresJson ? 4000 : 3000, // GPT-4.1 uses max_tokens (increased for complete responses)
      };
      
      // Use JSON mode for accurate, reliable JSON parsing
      // OpenAI JSON mode requires the prompt to explicitly request JSON (which our prompts do)
      if (requiresJson) {
        requestOptions.response_format = { type: 'json_object' };
      }
      
      const completion = await client.chat.completions.create(requestOptions);
      
      const responseText = completion.choices[0]?.message?.content || '';
      const usage = completion.usage || {};
      
      // Return response object with text() method for compatibility
      return {
        text: () => responseText,
        usageMetadata: {
          promptTokenCount: usage.prompt_tokens || null,
          candidatesTokenCount: usage.completion_tokens || null,
          totalTokenCount: usage.total_tokens || null
        }
      };
      
    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      
      console.error(`[${controllerName}] OpenAI API ERROR${retryAttempt > 0 ? ` - RETRY ${retryAttempt}/${maxRetries}` : ''}:`, {
        message: error.message,
        status: error.status || error.response?.status,
        code: error.code
      });
      
      // If retryable and haven't exhausted retries, try again
      if (isRetryable && retryAttempt < maxRetries) {
        continue;
      }
      
      // If not retryable, break immediately
      if (!isRetryable) {
        break;
      }
    }
  }
  
  // All retries exhausted
  if (lastError) {
    const errorMessage = lastError.message || 'AI service error occurred';
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new AppError(
        ERROR_CODES.AI_SERVICE_ERROR,
        'AI service rate limit exceeded. Please try again in a few moments.',
        429
      );
    }
    if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
      throw new AppError(
        ERROR_CODES.AI_SERVICE_ERROR,
        'AI service is temporarily overloaded. Please try again in a few moments.',
        503
      );
    }
    throw new AppError(
      ERROR_CODES.AI_SERVICE_ERROR,
      errorMessage,
      502
    );
  }
  
  throw new AppError(
    ERROR_CODES.AI_SERVICE_ERROR,
    'OpenAI API request failed. Please try again later.',
    502
  );
}

module.exports = {
  generateContentWithFallback
};
