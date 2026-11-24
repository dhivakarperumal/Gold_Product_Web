const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { getSummary, getTransactions, postTransaction } = require('../controllers/fundsController');

const router = express.Router();

router.use(requireAdmin);
router.use((req, res, next) => {
  if (req.adminUser.role !== 'admin') {
    return res.status(403).json({ message: 'Fund records are available to admins only' });
  }
  return next();
});

router.get('/summary', getSummary);
router.get('/transactions', getTransactions);
router.post('/transactions', postTransaction);

module.exports = router;
