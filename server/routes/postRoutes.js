const express = require('express');
const {
  getPostsFeed,
  getPostById,
  getPostsByUser,
  createPost,
  deletePost,
  toggleLike,
  addComment,
} = require('../controllers/postController');

const router = express.Router();

router.get('/feed', getPostsFeed);
router.get('/user/:userId', getPostsByUser);
router.get('/:id', getPostById);
router.post('/', createPost);
router.post('/:id/like', toggleLike);
router.delete('/:id/like', toggleLike);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);

module.exports = router;
