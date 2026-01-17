// src/controllers/resume.js
const prisma = require('../utils/prismaClient');
const { AppError, ERROR_CODES, asyncHandler } = require('../utils/errors');

// Helper to parse fullName into firstName and lastName
function parseFullName(fullName) {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

const loadResume = asyncHandler(async (req, res) => {
  // req.user is set by authenticateApiKey middleware
  if (!req.user) {
    throw new AppError(ERROR_CODES.AUTHENTICATION_ERROR, 'Authentication required', 401);
  }

  const userId = req.user.id;

  // Fetch both resume settings and user profile
  const [settings, user] = await Promise.all([
    prisma.resumeSettings.findUnique({
      where: { userId },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    }),
  ]);

  // Parse fullName from User profile
  const { firstName, lastName } = parseFullName(user?.fullName);
  const userEmail = user?.email || '';

  // If no saved settings, return null (will use defaults with user profile data)
  if (!settings) {
    return res.json({
      success: true,
      result: null,
      hasResume: false,
      profileData: user ? {
        firstName: firstName || '',
        lastName: lastName || '',
        email: userEmail || '',
      } : null,
      message: 'No saved resume settings found. Using default template with profile data.',
    });
  }

  const savedPersonalInfo = settings.personalInfo || {};
  
  // Merge User profile data into personalInfo (User data takes precedence for firstName/lastName/email)
  const mergedPersonalInfo = {
    ...savedPersonalInfo,
    firstName: firstName || savedPersonalInfo?.firstName || '',
    lastName: lastName || savedPersonalInfo?.lastName || '',
    email: userEmail || savedPersonalInfo?.email || '',
  };

  const resumeData = {
    personalInfo: mergedPersonalInfo,
    professionalSummary: settings.professionalSummary || '',
    education: settings.education || [],
    experience: settings.experience || [],
    skills: settings.skills || [],
    projects: settings.projects || [],
    customSections: settings.customSections || [],
    skillsDisplayMode: settings.skillsDisplayMode || 'twoColumnar',
    skillsLineTime: settings.skillsLineTime || [],
    sectionOrder: settings.sectionOrder || [],
    sectionNames: settings.sectionNames || {},
    deletedSections: (settings.deletedSections && Array.isArray(settings.deletedSections)) ? settings.deletedSections : [],
  };

  return res.json({
    success: true,
    result: resumeData,
    hasResume: true,
    profileData: user ? {
      firstName: firstName || '',
      lastName: lastName || '',
      email: userEmail || '',
    } : null,
    message: 'Resume loaded successfully',
  });
});

module.exports = {
  loadResume
};
