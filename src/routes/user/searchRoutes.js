const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/user/searchController');

// GET /api/v1/search/suggestions?q=abdurauf
router.get('/suggestions', searchController.getSuggestions);

module.exports = router;