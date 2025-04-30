const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const InstaBotController = require('../controllers/Instabot.controller');
const WalletController = require('../controllers/Wallet.controller');

const { protect, authorize, verifyOtp } = require('../middleware/auth');

router.route('/encryption').post(InstaBotController.encryptBody);
router.route('/decryption').post(InstaBotController.decryptBody);
router.route('/manychat-message').post(InstaBotController.manyChatMessage);
router.route('/get-subscriber_id/:account_id').get(InstaBotController.getSubscriberId);
router.route('/insta-verification').post(InstaBotController.verifyInstaChatbotLinkCode);
router.route('/insta-unlink/:account_id').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, InstaBotController.unlinkIntagramBot);
router.route('/telegram-unlink/:account_id').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, InstaBotController.unlinkTelegramBot);
router.route('/get-wallet-details').post(InstaBotController.getWalletDetails);
router.route('/get-by-wallet-id/:wallet_id').get(InstaBotController.getWalletByWalletId);
router.route('/get-user-insta-wallet-overview/:account_id').get(InstaBotController.getUsersInstaWalletOverview);
router.route('/get-exchange-rate').post(InstaBotController.getExchangeRates);
router.route('/insta-wallet-to-wallet').post(InstaBotController.instaWalletToWalletTransfer);
router.route('/get-user-beneficiaries').post(InstaBotController.getUserBeneficiaries);
router.route('/get-beneficiary-details').post(InstaBotController.getBeneficiaryDetails);
router.route('/get-user-details/:account_id').get(InstaBotController.getUserDetails);
router.route('/search-account/:query').get(InstaBotController.searchAccount);
router.route('/request-payment').post(InstaBotController.requestPaymentW2W);
router.route('/accept-payment-request').post(InstaBotController.acceptPaymentRequest);
router.route('/decline-payment-request/:request_id').get(InstaBotController.declinePaymentRequest);
router.route('/get-request-exchange-rate').post(InstaBotController.getExchangeRatesForRequest);
// router.route('/get-by-wallet-id/:wallet_id').get(InstaBotController.getWalletByWalletId);



router.route("/countries").post(InstaBotController.getCountries)
router.route("/services").post(InstaBotController.getServices)
router.route("/payername").post(InstaBotController.getPayerNames)
router.route("/payerinfo").post(InstaBotController.getPayerInfo)
router.route("/get-rates").post(InstaBotController.getPayerRates)
router.route("/createQuotation").post(InstaBotController.createQuotation)
router.route("/createTransaction").post(InstaBotController.createTransaction)
router.route("/confirmTransaction").post(InstaBotController.confirmTransaction)
router.route("/getStatus").post(InstaBotController.getStatus)
router.route("/set-password").post(InstaBotController.setPassword)
router.route("/set-pin").post(InstaBotController.setAccountPin)
router.route("/verify-pin").post(InstaBotController.verifyPin)

router.route("/set-qrpay-wallet").post(InstaBotController.setQrPayWallet)

module.exports = router;

