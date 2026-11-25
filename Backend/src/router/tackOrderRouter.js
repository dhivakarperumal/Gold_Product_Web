const express = require('express');
const { getTackOrders, postTackOrder } = require('../controllers/tackOrderController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAdmin);
router.get('/', getTackOrders);
router.post('/', postTackOrder);

module.exports = router;
