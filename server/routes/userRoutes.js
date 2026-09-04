const express = require('express');
const { getCurrentUser, updateCurrentUser, getUserById, getFollowers, getFollowing, followUser, unfollowUser, toggleSavedReel, toggleSavedPost } = require('../controllers/userController');

const router = express.Router();

router.get('/me', getCurrentUser);
router.patch('/me', updateCurrentUser);
router.post('/me/saved-reels/:reelId', toggleSavedReel);
router.delete('/me/saved-reels/:reelId', toggleSavedReel);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);
router.get('/:id', getUserById);
router.post('/:id/follow', followUser);
router.delete('/:id/follow', unfollowUser);
router.post('/:id/saved-reels/:reelId', toggleSavedReel);
router.delete('/:id/saved-reels/:reelId', toggleSavedReel);
router.post('/:id/saved-posts/:postId', toggleSavedPost);
router.delete('/:id/saved-posts/:postId', toggleSavedPost);

module.exports = router;
