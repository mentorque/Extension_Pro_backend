const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/openaiClient');
const { coverLetter } = require('../utils/prompts.json');
const { ValidationError, ERROR_CODES, createErrorResponse, asyncHandler } = require('../utils/errors');

const SYSTEM_PROMPT = coverLetter;
const COVERLETTER_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/coverletter.md'), 'utf8');

function extractJSONFromString(input) {
  const jsonMatch = input.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new ValidationError("Found a JSON block, but it contained invalid JSON.");
    }
  }

  try {
    return JSON.parse(input);
  } catch (err) {
    throw new ValidationError("Could not find a valid JSON object in the model's response.");
  }
}

const generateCoverLetter = asyncHandler(async (req, res) => {
  const { jobDescription, resume } = req.body;

  if (!jobDescription || !resume) {
    throw new ValidationError('Missing required fields: jobDescription and resume are required');
  }
  
  const resumeString = JSON.stringify(resume);
  const fullPrompt = `${SYSTEM_PROMPT}\n\nJob Description:\n${jobDescription}\n\nResume:\n${resumeString}\n\nIMPORTANT INSTRUCTIONS:\n- You MUST respond with ONLY a valid JSON object\n- Do NOT include any text, markdown, code blocks, or explanations outside the JSON\n- Follow the Response Format schema EXACTLY\n- Ensure all JSON is valid and parseable\n\nResponse Format:${COVERLETTER_SCHEMA}`;

  const response = await generateContentWithFallback(fullPrompt, 'COVERLETTER');
  const text = response.text();
  const extractedResult = extractJSONFromString(text);

  res.json({ success: true, result: extractedResult });
});

module.exports = { generateCoverLetter };