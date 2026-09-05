const express = require('express');
const { getStories, createStory, deleteStory, markStoryViewed } = require('../controllers/storyController');

const router = express.Router();

router.get('/', getStories);
router.post('/', createStory);
router.delete('/:storyId', deleteStory);
router.post('/:storyId/view', markStoryViewed);

module.exports = router;
