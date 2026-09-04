const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
const reelUploadDir = path.join(uploadDir, 'reels');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(reelUploadDir, { recursive: true });

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

const upload = multer({
  storage,
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
  storage,
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
  storage: reelStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video uploads are allowed for reels.'));
    }
    cb(null, true);
  },
});

const respondWithUploadedFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A file is required.' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return res.status(201).json({
    success: true,
    mediaUrl: fileUrl,
    url: fileUrl,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
  });
};

const respondWithUploadedReel = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A video file is required.' });
  }

  const mediaUrl = `/uploads/reels/${req.file.filename}`;
  return res.status(201).json({
    success: true,
    mediaUrl,
    url: mediaUrl,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
  });
};

router.post('/', imageUpload.single('image'), respondWithUploadedFile);
router.post('/image', imageUpload.single('image'), respondWithUploadedFile);
router.post('/file', upload.single('file'), respondWithUploadedFile);
router.post('/reel-video', (req, _res, next) => {
  console.log('[Snaply] reel upload request received');
  next();
}, reelUpload.single('file'), (req, res) => {
  console.log('[Snaply] reel upload success');
  respondWithUploadedReel(req, res);
});

module.exports = router;
