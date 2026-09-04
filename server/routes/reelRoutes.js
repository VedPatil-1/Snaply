const express = require('express');
const {
  getReels,
  getReelById,
  createReel,
  toggleLike,
  getComments,
  addComment,
  getReelsByUser,
} = require('../controllers/reelController');

const router = express.Router();

router.get('/', getReels);
router.get('/user/:userId', getReelsByUser);
router.get('/:id', getReelById);
router.get('/:id/comments', getComments);
router.post('/', createReel);
router.post('/:id/like', toggleLike);
router.delete('/:id/like', toggleLike);
router.post('/:id/comments', addComment);

module.exports = router;
