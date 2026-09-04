const express = require('express');
const { getSearchUsers, getSearchPosts } = require('../controllers/searchController');

const router = express.Router();

router.get('/users', getSearchUsers);
router.get('/posts', getSearchPosts);

module.exports = router;
