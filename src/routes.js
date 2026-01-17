// backend/src/routes.js
const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateApiKey } = require('./middleware/auth');
const { handleFileUpload } = require('./middleware/fileUpload'); // FIXED: handleFileUpload instead of uploadMiddleware

// Import controllers
const authController = require('./controllers/auth');
const usageController = require('./controllers/usage');
const chatController = require('./controllers/chat');
const coverletterController = require('./controllers/coverletter');
const experienceController = require('./controllers/experience');
const hrLookupController = require('./controllers/hrLookup');
const keywordsController = require('./controllers/keywords');
const uploadResumeController = require('./controllers/uploadResume');
const appliedJobsController = require('./controllers/appliedJobs');
const userSkillsController = require('./controllers/userSkills');
const resumeController = require('./controllers/resume');

// Public routes (no auth required)
// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Public API key validation endpoint (no auth required)
router.post('/auth/validate', authController.validateApiKeyPublic);

// Public usage check endpoint (requires API key in header, but uses its own validation)
router.get('/usage', usageController.getDailyUsageByApiKey);

// Protected routes (require API key)
router.use(authenticateApiKey); // Apply auth middleware to all routes below

// Chat routes
router.post('/chat', chatController.chatWithContext);

// Cover letter routes
router.post('/coverletter', coverletterController.generateCoverLetter);

// Experience routes
router.post('/experience', experienceController.generateExperience);

// HR Lookup routes
router.post('/hr-lookup', hrLookupController.hrLookup);

// Keywords routes
router.post('/keywords', keywordsController.generateKeywords);

// Resume upload routes - FIXED: handleFileUpload instead of uploadMiddleware
router.post('/upload-resume', handleFileUpload, uploadResumeController.uploadResume);

// Applied jobs routes
router.get('/applied-jobs', appliedJobsController.getAppliedJobs);
router.post('/applied-jobs', appliedJobsController.addAppliedJob);
router.delete('/applied-jobs/:id', appliedJobsController.deleteAppliedJob);
router.patch('/applied-jobs/:id/status', appliedJobsController.updateJobStatus);

// Usage routes (authenticated)
router.get('/usage/daily', usageController.getDailyUsage);

// User skills routes
router.get('/user-skills', userSkillsController.getUserSkills);
router.post('/user-skills', userSkillsController.saveUserSkills);

// Resume routes
router.get('/resume/load', resumeController.loadResume);

module.exports = router;