// src/controllers/keywords.js
const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/openaiClient');
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
  const { jobDescription, skills } = req.body;

  if (!jobDescription || !skills) {
    throw new ValidationError('Missing required fields: jobDescription and skills are required');
  }

  const skillsString = JSON.stringify(skills);
  const fullPrompt = `${SYSTEM_PROMPT}\n\nJob Description:\n${jobDescription}\n\nCurrent Skills:\n${skillsString}\n\nIMPORTANT INSTRUCTIONS:\n- You MUST respond with ONLY a valid JSON object\n- Do NOT include any text, markdown, code blocks, or explanations outside the JSON\n- Follow the Response Format schema EXACTLY\n- Ensure all JSON is valid and parseable\n- Format all skills using standard professional capitalization as shown in the schema examples (e.g., "Python", "React", "Machine Learning", "AWS")\n\nResponse Format:${SKILLS_SCHEMA}`;

  const response = await generateContentWithFallback(fullPrompt, 'KEYWORDS');
  const text = response.text();
  const extractedResult = extractJSONFromString(text);

  res.json({ success: true, result: extractedResult });
});

module.exports = { generateKeywords };