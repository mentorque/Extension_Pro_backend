// src/middleware/fileUpload.js
const multer = require('multer');
const { AppError, ERROR_CODES } = require('../utils/errors');

const fileUploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      const error = new AppError(
        ERROR_CODES.INVALID_FILE_TYPE,
        'Only PDF files are allowed',
        400
      );
      cb(error, false);
    }
  }
});

const handleFileUpload = fileUploadConfig.single('resume');

module.exports = { handleFileUpload };
