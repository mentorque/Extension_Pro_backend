# Gemini API Fallback Keys Setup

## How to Update .env File

Add the following environment variables to your `backend/.env` file:

```env
# Primary Gemini API Key
GEMINI_API_KEY=your_primary_api_key_here

# Fallback Gemini API Keys (used automatically when quota is exceeded)
GEMINI_API_KEY_FALLBACK_1=AIzaSyBqNHdWhKknWi15UmS0IOHftcInKOAJmA0
GEMINI_API_KEY_FALLBACK_2=AIzaSyCrOo7lsmmJBmC36W0ymxJxDRbDzdg7CRo
```

## How It Works

1. **Primary Key**: The system first tries `GEMINI_API_KEY`
2. **Automatic Fallback**: If a quota/resource exhausted error occurs, it automatically tries `GEMINI_API_KEY_FALLBACK_1`
3. **Second Fallback**: If the first fallback also fails with quota error, it tries `GEMINI_API_KEY_FALLBACK_2`
4. **Error Handling**: If all keys fail or it's a non-quota error, the original error is thrown

## Example .env File

```env
PORT=3000
DATABASE_URL=your_database_url
GEMINI_API_KEY=your_primary_key
GEMINI_API_KEY_FALLBACK_1=AIzaSyBqNHdWhKknWi15UmS0IOHftcInKOAJmA0
GEMINI_API_KEY_FALLBACK_2=AIzaSyCrOo7lsmmJBmC36W0ymxJxDRbDzdg7CRo
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_cse_id
```

## Logging

The system logs which API key is being used:
- `[CONTROLLER] Attempting with API key 1 (primary)`
- `[CONTROLLER] Attempting with API key 2 (fallback)`
- `[CONTROLLER] Quota exceeded, trying fallback API key 2...`
- `[CONTROLLER] Successfully used fallback API key 2`

## Controllers Updated

All Gemini API controllers now use the fallback system:
- ✅ `chat.js` - Chat with context
- ✅ `keywords.js` - Keyword extraction
- ✅ `coverletter.js` - Cover letter generation
- ✅ `experience.js` - Experience summary
- ✅ `uploadResume.js` - Resume parsing

## Testing

After updating your .env file, restart your server:

```bash
npm run dev
```

The fallback system will automatically activate when quota errors occur.

