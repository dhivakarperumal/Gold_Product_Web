const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const {
  deleteGoldShop,
  getGoldShop,
  getGoldShopPayments,
  getGoldShops,
  getPlans,
  patchGoldShopStatus,
  postGoldShop,
  postSubscription,
  putGoldShop
} = require('../controllers/superAdminGoldShopController');

const router = express.Router();

router.use(requireSuperAdmin);
router.get('/subscription-plans', getPlans);
router.get('/gold-shops', getGoldShops);
router.post('/gold-shops', postGoldShop);
router.get('/gold-shops/:id/payments', getGoldShopPayments);
router.post('/gold-shops/:id/subscription', postSubscription);
router.patch('/gold-shops/:id/status', patchGoldShopStatus);
router.get('/gold-shops/:id', getGoldShop);
router.put('/gold-shops/:id', putGoldShop);
router.delete('/gold-shops/:id', deleteGoldShop);

module.exports = router;
