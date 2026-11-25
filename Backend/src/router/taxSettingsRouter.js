const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { getTaxSettings, putTaxSettings } = require('../controllers/taxSettingsController');

const router = express.Router();

router.use(requireAdmin);
router.get('/', getTaxSettings);
router.put('/', putTaxSettings);

module.exports = router;
