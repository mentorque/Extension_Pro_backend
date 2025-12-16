const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/geminiClient');
const { experienceSummary } = require('../utils/prompts.json');
const { ValidationError, asyncHandler } = require('../utils/errors');

const SYSTEM_PROMPT = experienceSummary;
const EXPERIENCE_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/experience.md'), 'utf8');

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

const generateExperience = asyncHandler(async (req, res) => {
  const { jobDescription, experience } = req.body;

  if (!jobDescription || !experience) {
    throw new ValidationError('Missing required fields: jobDescription and experience are required');
  }

  const experienceString = JSON.stringify(experience);
  const fullPrompt = `${SYSTEM_PROMPT}\n Job Description:\n${jobDescription}\n Experience:\n${experienceString}\nResponse Format:${EXPERIENCE_SCHEMA}`;

  const response = await generateContentWithFallback(fullPrompt, 'EXPERIENCE');
  const text = response.text();
  const extractedResult = extractJSONFromString(text);
  console.log(extractedResult);
  res.json({ success: true, result: extractedResult });
});

module.exports = { generateExperience };