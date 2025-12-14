// src/controllers/keywords.js
const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/geminiClient');
const { keywordExtraction } = require('../utils/prompts.json');

const SKILLS_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/keywords.md'), 'utf8');
const SYSTEM_PROMPT = keywordExtraction;

function extractJSONFromString(input) {
  // Try to find JSON in code blocks first
  const jsonMatch = input.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error("Found a JSON block, but it contained invalid JSON.");
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
    
    throw new Error("Could not find a valid JSON object in the model's response.");
  }
}

const generateKeywords = async (req, res, next) => {
  try {
    console.log('[KEYWORDS] Request body:', {
      hasJobDescription: !!req.body?.jobDescription,
      hasSkills: !!req.body?.skills,
      jobDescriptionLength: req.body?.jobDescription?.length || 0,
      skillsLength: Array.isArray(req.body?.skills) ? req.body.skills.length : 'not array',
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers['content-type'],
      rawBody: req.body
    });
    
    const { jobDescription, skills } = req.body;

    if (!jobDescription || !skills) {
      console.error('[KEYWORDS] Missing required fields:', {
        hasJobDescription: !!jobDescription,
        hasSkills: !!skills,
        jobDescription: jobDescription ? 'present' : 'missing',
        skills: skills ? 'present' : 'missing'
      });
      return res.status(400).json({ error: 'Missing or invalid jobDescription or skills' });
    }

    const skillsString = JSON.stringify(skills);
    const fullPrompt = `${SYSTEM_PROMPT}\n Job Description:\n${jobDescription}\n\nCurrent Skills:\n${skillsString}\n\nResponse Format:${SKILLS_SCHEMA}`;

    const response = await generateContentWithFallback(fullPrompt, 'KEYWORDS');
    const text = response.text();

    const extractedResult = extractJSONFromString(text);

    res.json({ result: extractedResult });

  } catch (error) {
    next(error);
  }
};

module.exports = { generateKeywords };