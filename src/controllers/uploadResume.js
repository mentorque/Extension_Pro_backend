// src/controllers/uploadResume.js
const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/geminiClient');
const { resumeParser } = require('../utils/prompts.json');
const { ValidationError, asyncHandler } = require('../utils/errors');
const { validateSkills } = require('./userSkills');
const prisma = require('../utils/prismaClient');

const SYSTEM_PROMPT = resumeParser;
const EXPERIENCE_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/experience.md'), 'utf8');
const RESUME_SCHEMA = fs.readFileSync(path.join(__dirname, '../schemas/resume.md'), 'utf8');

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

const uploadResume = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  try {
    console.log('[uploadResume] Incoming request', {
      hasFile: !!req.file,
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
    });

    let resumeText = '';

    if (typeof req.body?.resumeText === 'string') {
      resumeText = req.body.resumeText;
      console.log('[uploadResume] Using resumeText from JSON body, length:', resumeText.length);
    } else {
      console.warn('[uploadResume] No resumeText provided');
      throw new ValidationError('No resume provided. Please provide resumeText.');
    }

    if (!resumeText || resumeText.trim().length === 0) {
      console.warn('[uploadResume] Empty resume text after extraction');
      throw new ValidationError('Empty resume text. Please provide valid resume content.');
    }

    const fullPrompt = `${SYSTEM_PROMPT}\n Candidate resume: ${resumeText}\n Experience Schema: ${EXPERIENCE_SCHEMA} and arrange all information in this format Resume Schema: ${RESUME_SCHEMA}`;
    console.log('[uploadResume] Prompt length:', fullPrompt.length);

    const response = await generateContentWithFallback(fullPrompt, 'UPLOAD_RESUME');
    const text = response.text();
    console.log('[uploadResume] Model response length:', text?.length || 0);

    const extractedResult = extractJSONFromString(text);
    console.log('[uploadResume] Parsed result keys:', Object.keys(extractedResult || {}));

    // Save skills to UserSkills if user is authenticated and skills exist
    if (req.user && extractedResult?.formatted_resume?.skills && Array.isArray(extractedResult.formatted_resume.skills)) {
      try {
        const userId = req.user.id;
        const userSkills = extractedResult.formatted_resume.skills;
        const validatedSkills = validateSkills(userSkills);
        
        await prisma.userSkills.upsert({
          where: { userId },
          update: {
            skills: validatedSkills,
            updatedAt: new Date()
          },
          create: {
            userId,
            skills: validatedSkills
          }
        });
        
        console.log('[uploadResume] Saved user skills:', validatedSkills.length);
      } catch (skillError) {
        // Don't fail the request if skill saving fails
        console.error('[uploadResume] Error saving user skills:', skillError);
      }
    }

    res.json({ success: true, result: extractedResult });
  } finally {
    console.log('[uploadResume] Completed in ms:', Date.now() - startedAt);
  }
});

module.exports = { uploadResume };