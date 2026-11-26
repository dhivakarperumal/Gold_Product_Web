const express = require('express');
const {
  getTackOrders,
  getTackOrder,
  patchTackOrderStatus,
  postTackOrder
} = require('../controllers/tackOrderController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAdmin);
router.get('/', getTackOrders);
router.get('/:id', getTackOrder);
router.post('/', postTackOrder);
router.patch('/:id/status', patchTackOrderStatus);

module.exports = router;
