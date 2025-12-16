const { generateContentWithFallback } = require('../utils/geminiClient');
const { chatAssistant } = require('../utils/prompts.json');
const { ValidationError, asyncHandler } = require('../utils/errors');

const SYSTEM_PROMPT = chatAssistant;

const chatWithContext = asyncHandler(async (req, res) => {
  const { jobDescription, resume, question } = req.body || {};

  if (!question || !jobDescription || !resume) {
    throw new ValidationError('Missing required fields: question, jobDescription, and resume are required');
  }

  const resumeString = typeof resume === 'string' ? resume : JSON.stringify(resume);
  const fullPrompt = `${SYSTEM_PROMPT}\n\nJob Description:\n${jobDescription}\n\nCandidate Resume (JSON):\n${resumeString}\n\nUser Question:\n${question}`;

  const response = await generateContentWithFallback(fullPrompt, 'CHAT');
  const text = (response && typeof response.text === 'function') ? response.text() : '';

  let answer = (text || '').trim();

  return res.json({ success: true, result: answer });
});

module.exports = { chatWithContext };


