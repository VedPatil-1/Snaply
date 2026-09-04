const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const {
  isCloudinaryConfigured,
  uploadBuffer,
} = require('../config/cloudinary');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
const reelUploadDir = path.join(uploadDir, 'reels');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(reelUploadDir, { recursive: true });

const useCloudinary = isCloudinaryConfigured();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    const extension = path.extname(safeName) || '.jpg';
    const basename = path.basename(safeName, extension);
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}-${basename}${extension}`;
    cb(null, unique);
  },
});

const uploadStorage = useCloudinary ? multer.memoryStorage() : storage;

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/', 'video/'].some((prefix) => file.mimetype.startsWith(prefix));
    if (!ok) {
      return cb(new Error('Only image and video uploads are allowed.'));
    }
    cb(null, true);
  },
});

const imageUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  },
});

const reelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reelUploadDir),
  filename: (_req, file, cb) => {
    cb(null, `reel-${Date.now()}-${Math.random().toString(16).slice(2)}.mp4`);
  },
});

const reelUpload = multer({
  storage: useCloudinary ? multer.memoryStorage() : reelStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video uploads are allowed for reels.'));
    }
    cb(null, true);
  },
});

const requireCloudinaryInProduction = (_req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !useCloudinary) {
    return res.status(503).json({ message: 'Cloudinary upload storage is not configured.' });
  }
  next();
};

const getCloudinaryUpload = async (file, resourceType, folder) => {
  const result = await uploadBuffer(file.buffer, {
    folder,
    resource_type: resourceType,
  });

  return {
    mediaUrl: result.secure_url,
    fileName: result.public_id || file.originalname,
  };
};

const respondWithUploadedFile = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A file is required.' });
  }

  try {
    const uploaded = useCloudinary
      ? await getCloudinaryUpload(req.file, req.file.mimetype.startsWith('video/') ? 'video' : 'image', 'snaply/uploads')
      : {
          mediaUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
          fileName: req.file.filename,
        };

    const fileUrl = uploaded.mediaUrl;
    return res.status(201).json({
      success: true,
      mediaUrl: fileUrl,
      url: fileUrl,
      fileName: uploaded.fileName,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    return next(new Error('Cloudinary image upload failed.'));
  }
};

const respondWithUploadedReel = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A video file is required.' });
  }

  try {
    if (useCloudinary) {
      const uploaded = await getCloudinaryUpload(req.file, 'video', 'snaply/reels');
      return res.status(201).json({
        success: true,
        mediaUrl: uploaded.mediaUrl,
        url: uploaded.mediaUrl,
        fileName: uploaded.fileName,
        mimeType: req.file.mimetype,
      });
    }

    const mediaUrl = `/uploads/reels/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      mediaUrl,
      url: mediaUrl,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    return next(new Error('Cloudinary reel upload failed.'));
  }
};

router.post('/', requireCloudinaryInProduction, imageUpload.single('image'), respondWithUploadedFile);
router.post('/image', requireCloudinaryInProduction, imageUpload.single('image'), respondWithUploadedFile);
router.post('/file', requireCloudinaryInProduction, upload.single('file'), respondWithUploadedFile);
router.post('/reel-video', requireCloudinaryInProduction, (req, _res, next) => {
  console.log('[Snaply] reel upload request received');
  next();
}, reelUpload.single('file'), (req, res) => {
  console.log('[Snaply] reel upload success');
  respondWithUploadedReel(req, res);
});

module.exports = router;
