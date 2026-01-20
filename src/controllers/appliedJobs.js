// src/controllers/appliedJobs.js
const prisma = require('../utils/prismaClient');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * Validates if a title is actually a job title and not navigation/button text
 * @param {string} title - The title to validate
 * @returns {boolean} - True if valid job title, false otherwise
 */
const isValidJobTitle = (title) => {
  if (!title || typeof title !== 'string') {
    return false;
  }

  const trimmedTitle = title.trim();
  
  // Basic length checks
  if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
    return false;
  }

  // Must contain at least 3 letters (not just numbers/symbols)
  if (!/[a-zA-Z]{3,}/.test(trimmedTitle)) {
    return false;
  }

  const titleLower = trimmedTitle.toLowerCase();

  // Reject specific extension UI texts that are being incorrectly captured as job titles
  // These exact texts must be rejected
  const exactUiTextsToReject = [
    'keywords & skills analyzer',
    'keywords and skills analyzer',
    'cover letter generator',
    'coverletter generator',
    'update to our terms',
    'ask about your fit',
    'ask about your experience',
    'ask about your fit or experience'
  ];
  
  // Check for exact matches first (most important)
  if (exactUiTextsToReject.some(uiText => titleLower === uiText)) {
    return false;
  }
  
  // Additional UI patterns that should be rejected
  const uiPatternsToReject = [
    'update terms',
    // Partial matches for common UI patterns
    'keywords &',
    '& skills analyzer',
    'cover letter generator',
    'letter generator'
  ];
  
  // Check for partial matches
  if (uiPatternsToReject.some(uiText => 
    titleLower.startsWith(uiText + ' ') || 
    titleLower.endsWith(' ' + uiText) ||
    titleLower.includes(' ' + uiText + ' ')
  )) {
    return false;
  }
  
  // Reject if title contains specific patterns that indicate UI text
  // Pattern: "keywords" + "analyzer" together (from "Keywords & Skills Analyzer")
  if (titleLower.includes('keyword') && titleLower.includes('analyzer')) {
    return false;
  }
  
  // Pattern: "update" + "terms" together (from "Update to our terms")
  if (titleLower.includes('update') && (titleLower.includes('terms') || titleLower.includes('our'))) {
    return false;
  }
  
  // Pattern: "cover letter" + "generator" together (from "Cover Letter Generator")
  if ((titleLower.includes('cover letter') || titleLower.includes('coverletter')) && titleLower.includes('generator')) {
    return false;
  }

  // Reject if it's only numbers, spaces, dashes, or dots
  if (/^[0-9\s\-\.]+$/.test(trimmedTitle)) {
    return false;
  }

  return true;
};

// Get all applied jobs for a user
const getAppliedJobs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const appliedJobs = await prisma.appliedJob.findMany({
    where: { userId },
    orderBy: { appliedDate: 'desc' }
  });

  return res.status(200).json({
    success: true,
    appliedJobs
  });
});

// Add a new applied job
const addAppliedJob = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, company, location, url, appliedDate, appliedText } = req.body;

  if (!title || !url) {
    throw new ValidationError('Title and URL are required');
  }

  // Validate that title is actually a job title and not navigation/button text
  if (!isValidJobTitle(title)) {
    throw new ValidationError('Invalid job title. The title appears to be navigation or button text, not an actual job posting. Please ensure you are tracking an actual job posting.');
  }

  // Check if job already exists for this user
  const existing = await prisma.appliedJob.findFirst({
    where: {
      userId,
      url
    }
  });

  if (existing) {
    return res.status(200).json({
      success: true,
      message: 'Job already tracked',
      appliedJob: existing
    });
  }

  const appliedJob = await prisma.appliedJob.create({
    data: {
      userId,
      title,
      company: company || null,
      location: location || null,
      url,
      appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
      appliedText: appliedText || null,
      status: 'Applied'
    }
  });

  return res.status(201).json({
    success: true,
    appliedJob
  });
});

// Delete an applied job
const deleteAppliedJob = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  

  // Verify the job belongs to the user
  const job = await prisma.appliedJob.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!job) {
    throw new NotFoundError('Applied job not found');
  }

  await prisma.appliedJob.delete({
    where: { id }
  });

  return res.status(200).json({
    success: true,
    message: 'Applied job deleted'
  });
});

// Update job status
const updateJobStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { status } = req.body;
  

  if (!status) {
    throw new ValidationError('Status is required');
  }

  // Verify the job belongs to the user
  const job = await prisma.appliedJob.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!job) {
    throw new NotFoundError('Applied job not found');
  }

  const updatedJob = await prisma.appliedJob.update({
    where: { id },
    data: { status }
  });

  return res.status(200).json({
    success: true,
    appliedJob: updatedJob
  });
});

module.exports = {
  getAppliedJobs,
  addAppliedJob,
  deleteAppliedJob,
  updateJobStatus
};

