// src/controllers/uploadResume.js
const path = require('path');
const fs = require('fs');
const { generateContentWithFallback } = require('../utils/openaiClient');
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
  let resumeText = '';

  if (typeof req.body?.resumeText === 'string') {
    resumeText = req.body.resumeText;
  } else {
    throw new ValidationError('No resume provided. Please provide resumeText.');
  }

  if (!resumeText || resumeText.trim().length === 0) {
    throw new ValidationError('Empty resume text. Please provide valid resume content.');
  }

  const fullPrompt = `${SYSTEM_PROMPT}\n\nCandidate Resume:\n${resumeText}\n\nExperience Schema:\n${EXPERIENCE_SCHEMA}\n\nIMPORTANT INSTRUCTIONS:\n- You MUST respond with ONLY a valid JSON object\n- Do NOT include any text, markdown, code blocks, or explanations outside the JSON\n- Follow the Resume Schema EXACTLY\n- Use the Experience Schema for experience entries\n- Ensure all JSON is valid and parseable\n\nResume Schema:\n${RESUME_SCHEMA}`;

  const response = await generateContentWithFallback(fullPrompt, 'UPLOAD_RESUME');
  const text = response.text();
  const extractedResult = extractJSONFromString(text);

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
    } catch (skillError) {
      // Don't fail the request if skill saving fails - only log errors
      console.error('[uploadResume] Error saving user skills:', skillError.message);
    }
  }

  res.json({ success: true, result: extractedResult });
});

module.exports = { uploadResume };