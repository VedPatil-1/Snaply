const express = require('express');
const { getStories } = require('../controllers/storyController');

const router = express.Router();

router.get('/', getStories);

module.exports = router;
