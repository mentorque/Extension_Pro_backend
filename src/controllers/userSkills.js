// src/controllers/userSkills.js
const prisma = require('../utils/prismaClient');
const { asyncHandler, ValidationError } = require('../utils/errors');
const path = require('path');
const fs = require('fs');

// Load skills database for validation
let skillsDatabase = null;
let skillsNormalizedMap = null;

function normalizeForMatching(skill) {
  return skill.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function loadSkillsDatabaseSync() {
  if (skillsDatabase && skillsNormalizedMap) {
    return; // Already loaded
  }
  
  try {
    const textFilePath = path.resolve(__dirname, '../utils/skills.txt');
    const jsonFilePath = path.resolve(__dirname, '../utils/skillsDatabase.json');
    
    let allSkills = [];
    
    // Try text file first (17k skills)
    if (fs.existsSync(textFilePath)) {
      const fileContent = fs.readFileSync(textFilePath, 'utf8');
      const lines = fileContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          allSkills.push({
            name: trimmed,
            normalized: normalizeForMatching(trimmed)
          });
        }
      }
    } else if (fs.existsSync(jsonFilePath)) {
      // Fallback to JSON format
      const skillsData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      
      for (const [category, skills] of Object.entries(skillsData)) {
        for (const skill of skills) {
          allSkills.push({
            name: skill,
            normalized: normalizeForMatching(skill)
          });
        }
      }
    }
    
    skillsDatabase = allSkills;
    
    // Create fast O(1) lookup map
    skillsNormalizedMap = new Map();
    for (const skill of allSkills) {
      skillsNormalizedMap.set(skill.normalized, skill.name);
    }
    
    console.log(`[UserSkills] Loaded ${allSkills.length} skills for validation`);
  } catch (error) {
    console.error('[UserSkills] Error loading skills database:', error);
    // Continue without validation if database can't be loaded
    skillsDatabase = [];
    skillsNormalizedMap = new Map();
  }
}

// Validate skills against database
function validateSkills(userSkills) {
  if (!Array.isArray(userSkills)) {
    return [];
  }
  
  loadSkillsDatabaseSync();
  
  const validatedSkills = [];
  const seen = new Set();
  
  for (const skill of userSkills) {
    if (!skill || typeof skill !== 'string') continue;
    
    const normalized = normalizeForMatching(skill);
    
    // Check exact match
    if (skillsNormalizedMap.has(normalized)) {
      const canonicalSkill = skillsNormalizedMap.get(normalized);
      if (!seen.has(normalized)) {
        validatedSkills.push(canonicalSkill);
        seen.add(normalized);
      }
    } else {
      // If not in database, still include it (user might have custom skills)
      if (!seen.has(normalized)) {
        validatedSkills.push(skill.trim());
        seen.add(normalized);
      }
    }
  }
  
  return validatedSkills;
}

// Save or update user skills
const saveUserSkills = asyncHandler(async (req, res) => {
  const { skills, skillsDisplayMode, skillsLineTime } = req.body;
  
  if (!skills || !Array.isArray(skills)) {
    throw new ValidationError('Skills array is required');
  }
  
  const userId = req.user.id;
  
  // Validate skills against database
  const validatedSkills = validateSkills(skills);
  
  // Upsert user skills
  const userSkills = await prisma.userSkills.upsert({
    where: { userId },
    update: {
      skills: validatedSkills,
      skillsDisplayMode: skillsDisplayMode || null,
      skillsLineTime: skillsLineTime || null,
      updatedAt: new Date()
    },
    create: {
      userId,
      skills: validatedSkills,
      skillsDisplayMode: skillsDisplayMode || null,
      skillsLineTime: skillsLineTime || null
    }
  });
  
  res.json({
    success: true,
    result: {
      skills: userSkills.skills,
      skillsDisplayMode: userSkills.skillsDisplayMode,
      skillsLineTime: userSkills.skillsLineTime
    }
  });
});

// Get user skills
const getUserSkills = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const userSkills = await prisma.userSkills.findUnique({
    where: { userId }
  });
  
  if (!userSkills) {
    return res.json({
      success: true,
      result: {
        skills: [],
        skillsDisplayMode: null,
        skillsLineTime: null
      }
    });
  }
  
  res.json({
    success: true,
    result: {
      skills: userSkills.skills,
      skillsDisplayMode: userSkills.skillsDisplayMode,
      skillsLineTime: userSkills.skillsLineTime
    }
  });
});

module.exports = {
  saveUserSkills,
  getUserSkills,
  validateSkills
};
