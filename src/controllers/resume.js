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

  // Log what we got from the database
  console.log('[loadResume] Database fetch results:', {
    userId,
    hasSettings: !!settings,
    hasUser: !!user,
    userFullName: user?.fullName,
    userEmail: user?.email,
    personalInfoFromDB: settings?.personalInfo
  });

  // Parse fullName from User profile
  const { firstName: userFirstName, lastName: userLastName } = parseFullName(user?.fullName || '');
  const userEmail = user?.email || '';

  // If no saved settings, return null (will use defaults with user profile data)
  if (!settings) {
    return res.json({
      success: true,
      result: null,
      hasResume: false,
      profileData: user ? {
        firstName: userFirstName || '',
        lastName: userLastName || '',
        email: userEmail || '',
      } : null,
      message: 'No saved resume settings found. Using default template with profile data.',
    });
  }

  // Ensure personalInfo is properly parsed (it's JSON in DB, Prisma should parse it automatically)
  let savedPersonalInfo = {};
  try {
    if (settings.personalInfo) {
      // If it's already an object (Prisma parsed it), use it directly
      // If it's a string, parse it
      savedPersonalInfo = typeof settings.personalInfo === 'string' 
        ? JSON.parse(settings.personalInfo) 
        : settings.personalInfo;
    }
  } catch (error) {
    console.error('[loadResume] Error parsing personalInfo:', error);
    savedPersonalInfo = {};
  }

  console.log('[loadResume] Personal info merge:', {
    userFirstName,
    userLastName,
    userEmail,
    savedPersonalInfo,
    savedFirstName: savedPersonalInfo?.firstName,
    savedLastName: savedPersonalInfo?.lastName,
    savedEmail: savedPersonalInfo?.email
  });
  
  // Merge User profile data into personalInfo (User data takes precedence for firstName/lastName/email)
  // If User table has firstName/lastName, use those; otherwise use savedPersonalInfo values
  const mergedPersonalInfo = {
    ...savedPersonalInfo, // Start with all saved personal info (phoneNumber, linkedin, location, etc.)
    firstName: userFirstName || savedPersonalInfo?.firstName || '', // User.fullName takes precedence
    lastName: userLastName || savedPersonalInfo?.lastName || '', // User.fullName takes precedence
    email: userEmail || savedPersonalInfo?.email || '', // User.email takes precedence
  };

  console.log('[loadResume] Final merged personalInfo:', mergedPersonalInfo);

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
      firstName: userFirstName || '',
      lastName: userLastName || '',
      email: userEmail || '',
    } : null,
    message: 'Resume loaded successfully',
  });
});

module.exports = {
  loadResume
};
