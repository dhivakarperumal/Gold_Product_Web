const express = require('express');
const { postTackOrder } = require('../controllers/tackOrderController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAdmin);
router.post('/', postTackOrder);

module.exports = router;
