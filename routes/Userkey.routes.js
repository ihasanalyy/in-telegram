const express = require('express');
const router = express.Router();
console.log('userkey routes loaded')
const { protect, authorize } = require('../middleware/auth');
const UserkeyController = require('../controllers/Userkey.controller');


router.route('/create-user-key').post(UserkeyController.addUserKeyData);
router.route('/create-online-payment').post(UserkeyController.createOnlinePayment);
router.route('/update-user-key-status').post(UserkeyController.updateUserkeyStatus);
router.route('/get-apikey/:account_id').get(UserkeyController.getUserKey);
router.route('/request-user-key/:account_id').get(UserkeyController.requestUserkey);
router.route('/account-user-key/:account_id').get(UserkeyController.getAccountsUserkey);

router.route('/get-payment-url-data/:payment_url_id').get(UserkeyController.getOnlinePaymentData);

module.exports = router;
