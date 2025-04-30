const express = require("express");
const router = express.Router();
const { protect, authorize, verifyOtp } = require('../middleware/auth');
const GuestPayController = require('../controllers/Guest-Pay.controller');

router.route("/payment-methods/:level_id").get(GuestPayController.getAvailableMethods)

// paypal
router.route("/paypal-fee/:wallet_id/:amount").get(GuestPayController.getPaypalFee)
router.route("/initiate-paypal").post(GuestPayController.initiatPaypalTransaction)

// trust payment
router.route("/card-fee/:wallet_id/:amount").get(GuestPayController.getCardFee)
router.route("/initiate-card-payment").post(GuestPayController.initiatTrustPaymentTransaction)
router.route("/confirm-card-payment/:transaction_id").post(GuestPayController.trustPaymentConfirmation)


module.exports = router;