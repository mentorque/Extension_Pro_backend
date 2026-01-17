// src/controllers/keywords.js
const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/geminiClient');
const { keywordExtraction } = require('../utils/prompts.json');
const { ValidationError, asyncHandler } = require('../utils/errors');

const SKILLS_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/keywords.md'), 'utf8');
const SYSTEM_PROMPT = keywordExtraction;

function extractJSONFromString(input) {
  // Try to find JSON in code blocks first
  const jsonMatch = input.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new ValidationError("Found a JSON block, but it contained invalid JSON.");
    }
  }

  // Try to parse the entire response as JSON
  try {
    return JSON.parse(input);
  } catch (err) {
    // Try to extract JSON from anywhere in the response
    const jsonObjectMatch = input.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch (err2) {
        // Final fallback failed
      }
    }
    
    throw new ValidationError("Could not find a valid JSON object in the model's response.");
  }
}

const generateKeywords = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  console.log('[KEYWORDS] ===== Request received =====');
  console.log('[KEYWORDS] Request body:', {
    hasJobDescription: !!req.body?.jobDescription,
    hasSkills: !!req.body?.skills,
    jobDescriptionLength: req.body?.jobDescription?.length || 0,
    skillsLength: Array.isArray(req.body?.skills) ? req.body.skills.length : 'not array',
    bodyKeys: Object.keys(req.body || {}),
    contentType: req.headers['content-type'],
  });
  
  const { jobDescription, skills } = req.body;

  if (!jobDescription || !skills) {
    console.error('[KEYWORDS] Missing required fields:', {
      hasJobDescription: !!jobDescription,
      hasSkills: !!skills,
      jobDescription: jobDescription ? 'present' : 'missing',
      skills: skills ? 'present' : 'missing'
    });
    throw new ValidationError('Missing required fields: jobDescription and skills are required');
  }

  // Step 1: Prepare prompt
  const promptStartTime = Date.now();
  const skillsString = JSON.stringify(skills);
  const fullPrompt = `${SYSTEM_PROMPT}\n Job Description:\n${jobDescription}\n\nCurrent Skills:\n${skillsString}\n\nResponse Format:${SKILLS_SCHEMA}`;
  const promptTime = Date.now() - promptStartTime;
  const promptLength = fullPrompt.length;
  const promptWordCount = fullPrompt.split(/\s+/).length;
  console.log(`[KEYWORDS] ⏱️  Prompt preparation: ${promptTime}ms`);
  console.log(`[KEYWORDS] 📝 Prompt Stats:`, {
    totalLength: promptLength,
    wordCount: promptWordCount,
    sizeKB: (promptLength / 1024).toFixed(2),
    jobDescriptionLength: jobDescription.length,
    skillsCount: Array.isArray(skills) ? skills.length : 0,
    skillsStringLength: skillsString.length,
    systemPromptLength: SYSTEM_PROMPT.length,
    schemaLength: SKILLS_SCHEMA.length
  });

  // Step 2: Call Gemini API
  const geminiStartTime = Date.now();
  console.log('[KEYWORDS] 📡 Calling Gemini API...');
  const response = await generateContentWithFallback(fullPrompt, 'KEYWORDS');
  const geminiTime = Date.now() - geminiStartTime;
  console.log(`[KEYWORDS] ✅ Gemini API response received: ${geminiTime}ms`);

  // Step 3: Extract text from response
  const textExtractStartTime = Date.now();
  const text = response.text();
  const textExtractTime = Date.now() - textExtractStartTime;
  console.log(`[KEYWORDS] ⏱️  Text extraction: ${textExtractTime}ms`);
  
  // Log response metadata if available
  const usageMetadata = response.usageMetadata || {};
  if (usageMetadata.totalTokenCount) {
    console.log(`[KEYWORDS] 🎯 Token Usage Details:`, {
      promptTokens: usageMetadata.promptTokenCount || 'N/A',
      candidatesTokens: usageMetadata.candidatesTokenCount || 'N/A',
      totalTokens: usageMetadata.totalTokenCount || 'N/A',
      responseTextLength: text.length,
      responseWordCount: text.split(/\s+/).length
    });
  }

  // Step 4: Parse JSON
  const parseStartTime = Date.now();
  const extractedResult = extractJSONFromString(text);
  const parseTime = Date.now() - parseStartTime;
  console.log(`[KEYWORDS] ⏱️  JSON parsing: ${parseTime}ms`);

  // Total time
  const totalTime = Date.now() - startTime;
  console.log(`[KEYWORDS] ===== Request completed =====`);
  console.log(`[KEYWORDS] 📊 TIMING BREAKDOWN:`);
  console.log(`[KEYWORDS]    - Prompt preparation: ${promptTime}ms`);
  console.log(`[KEYWORDS]    - Gemini API call: ${geminiTime}ms (${((geminiTime / totalTime) * 100).toFixed(1)}%)`);
  console.log(`[KEYWORDS]    - Text extraction: ${textExtractTime}ms`);
  console.log(`[KEYWORDS]    - JSON parsing: ${parseTime}ms`);
  console.log(`[KEYWORDS]    - TOTAL TIME: ${totalTime}ms`);
  console.log(`[KEYWORDS] =============================`);

  res.json({ success: true, result: extractedResult });
});

module.exports = { generateKeywords };