const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/geminiClient');
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
  console.log('[COVERLETTER] Request body:', {
    hasJobDescription: !!req.body?.jobDescription,
    hasResume: !!req.body?.resume,
    jobDescriptionLength: req.body?.jobDescription?.length || 0,
    resumeKeys: req.body?.resume ? Object.keys(req.body.resume) : 'not object',
    bodyKeys: Object.keys(req.body || {}),
    contentType: req.headers['content-type']
  });
  
  const { jobDescription, resume } = req.body;

  if (!jobDescription || !resume) {
    console.error('[COVERLETTER] Missing required fields:', {
      hasJobDescription: !!jobDescription,
      hasResume: !!resume,
      jobDescription: jobDescription ? 'present' : 'missing',
      resume: resume ? 'present' : 'missing'
    });
    throw new ValidationError('Missing required fields: jobDescription and resume are required');
  }
  
  const resumeString = JSON.stringify(resume);
  const fullPrompt = `${SYSTEM_PROMPT}\n Job Description:\n${jobDescription}\n\nresume:\n${resumeString}\n\nResponse Format:${COVERLETTER_SCHEMA}`;

  const response = await generateContentWithFallback(fullPrompt, 'COVERLETTER');
  const text = response.text();
  
  console.log('AI Response Text:', text); // Debug log

  const extractedResult = extractJSONFromString(text);
  console.log('Extracted Result:', extractedResult); // Debug log

  res.json({ success: true, result: extractedResult });
});

module.exports = { generateCoverLetter };