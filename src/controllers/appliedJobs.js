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

  // Reject if contains "keyword" or "update" (case-insensitive)
  if (titleLower.includes('keyword') || titleLower.includes('update')) {
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
  const startTime = Date.now();
  const userId = req.user.id;
  
  console.log(`[APPLIED_JOBS] GET /api/applied-jobs - User: ${userId} - Starting fetch`);
  
  const appliedJobs = await prisma.appliedJob.findMany({
    where: { userId },
    orderBy: { appliedDate: 'desc' }
  });

  const duration = Date.now() - startTime;
  console.log(`[APPLIED_JOBS] GET /api/applied-jobs - User: ${userId} - Success: Found ${appliedJobs.length} jobs in ${duration}ms`);

  return res.status(200).json({
    success: true,
    appliedJobs
  });
});

// Add a new applied job
const addAppliedJob = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const { title, company, location, url, appliedDate, appliedText } = req.body;
  
  console.log(`[APPLIED_JOBS] POST /api/applied-jobs - User: ${userId} - Adding job:`, {
    title: title?.substring(0, 50) + (title?.length > 50 ? '...' : ''),
    company,
    location,
    url: url?.substring(0, 100) + (url?.length > 100 ? '...' : ''),
    appliedDate,
    appliedText
  });

  if (!title || !url) {
    console.log(`[APPLIED_JOBS] POST /api/applied-jobs - User: ${userId} - Validation failed: Missing title or URL`);
    throw new ValidationError('Title and URL are required');
  }

  // Validate that title is actually a job title and not navigation/button text
  if (!isValidJobTitle(title)) {
    console.log(`[APPLIED_JOBS] POST /api/applied-jobs - User: ${userId} - Validation failed: Invalid job title (contains navigation/button text): "${title}"`);
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
    const duration = Date.now() - startTime;
    console.log(`[APPLIED_JOBS] POST /api/applied-jobs - User: ${userId} - Job already exists (${duration}ms):`, {
      existingId: existing.id,
      existingTitle: existing.title
    });
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

  const duration = Date.now() - startTime;
  console.log(`[APPLIED_JOBS] POST /api/applied-jobs - User: ${userId} - Success: Created job ${appliedJob.id} in ${duration}ms`);

  return res.status(201).json({
    success: true,
    appliedJob
  });
});

// Delete an applied job
const deleteAppliedJob = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const { id } = req.params;
  
  console.log(`[APPLIED_JOBS] DELETE /api/applied-jobs/${id} - User: ${userId} - Starting deletion`);

  // Verify the job belongs to the user
  const job = await prisma.appliedJob.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!job) {
    const duration = Date.now() - startTime;
    console.log(`[APPLIED_JOBS] DELETE /api/applied-jobs/${id} - User: ${userId} - Job not found (${duration}ms)`);
    throw new NotFoundError('Applied job not found');
  }

  await prisma.appliedJob.delete({
    where: { id }
  });

  const duration = Date.now() - startTime;
  console.log(`[APPLIED_JOBS] DELETE /api/applied-jobs/${id} - User: ${userId} - Success: Deleted job "${job.title}" in ${duration}ms`);

  return res.status(200).json({
    success: true,
    message: 'Applied job deleted'
  });
});

// Update job status
const updateJobStatus = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const { id } = req.params;
  const { status } = req.body;
  
  console.log(`[APPLIED_JOBS] PATCH /api/applied-jobs/${id}/status - User: ${userId} - Updating status to: ${status}`);

  if (!status) {
    console.log(`[APPLIED_JOBS] PATCH /api/applied-jobs/${id}/status - User: ${userId} - Validation failed: Missing status`);
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
    const duration = Date.now() - startTime;
    console.log(`[APPLIED_JOBS] PATCH /api/applied-jobs/${id}/status - User: ${userId} - Job not found (${duration}ms)`);
    throw new NotFoundError('Applied job not found');
  }

  const updatedJob = await prisma.appliedJob.update({
    where: { id },
    data: { status }
  });

  const duration = Date.now() - startTime;
  console.log(`[APPLIED_JOBS] PATCH /api/applied-jobs/${id}/status - User: ${userId} - Success: Updated job "${job.title}" status from "${job.status}" to "${status}" in ${duration}ms`);

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

