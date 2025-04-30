const express = require('express');
const router = express.Router();
console.log('paypal routes loaded')
const { protect, authorize, verifyOtp } = require('../middleware/auth');
const PaypalController = require('../controllers/Paypal.controller');
const WalletController = require('../controllers/Wallet.controller');

router.route('/initiate-payment').post(PaypalController.initiatPaypalTransaction);
router.route('/webhook').post(PaypalController.getPaypalPayment);
router.route('/payment-details/:payment_id').get(PaypalController.getPaymentDetails);
router.route('/refund/:payment_id').post(PaypalController.refundSale);
router.route('/fee/:wallet_id/:amount').get(PaypalController.getPaypalFee);

// international payment
router.route('/initiate-international-payment').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, PaypalController.initiatIntlPaypalTransaction);

// w2w
router.route('/initiate-w2w-payment').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, PaypalController.initiatW2WPaypalTransaction);

// KYC
router.route('/initiate-kyc-payment').post(protect, authorize(['user']), PaypalController.initiateKYCPaypalTransaction);

// airtime
router.route('/initiate-airtime-ranged-payment').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, PaypalController.initiateAirtimePaypalTransaction);
router.route('/initiate-airtime-fixed-payment').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, PaypalController.initiateAirtimeFixedPaypalTransaction);

// send bot notifications
router.route('/send-bot-notification').post(PaypalController.sendBotNotification);
router.route('/send-bot-notification-telegram').post(PaypalController.sendBotNotificationTelegram);
module.exports = router;
