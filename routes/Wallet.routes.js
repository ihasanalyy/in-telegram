const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const WalletController = require('../controllers/Wallet.controller');
const AccountController = require('../controllers/Account.controller');

const { protect, authorize, verifyOtp } = require('../middleware/auth');
const { formatW2WData } = require('../utils/helpers');
const { upload } = require('../utils/multer');

router.route('/get-user-wallet/:account_id').get(WalletController.getUserWallet);
router.route('/get-user-insta-wallet/:account_id').get(WalletController.getUserInstaWallet);
router.route('/get-user-wallets/:query').get(protect, authorize(['user']), WalletController.getSearchedWallets);
router.route('/get-user-crypto-wallet/:account_id').get(WalletController.getUserCryptoWallet);
router.route('/get-by-wallet-id/:wallet_id').get(WalletController.getWalletByWalletId);
router.route('/get-wallet-details/:wallet_id').get(WalletController.getWalletDetails);
router.route('/activate-wallet/:id').get(WalletController.activateWallet);
router.route('/deactivate-wallet/:id').get(WalletController.deactivateWallet);
router.route('/set-to-default-wallet/:id').get(WalletController.setToDefaultWallet);
router.route('/get-exchange-rate').get(WalletController.getExchangeRates);
router.route('/get-new-exchange-rate').get(WalletController.getExchangeRatesNew);
router.route('/get-plain-exchange-rate').get(WalletController.getPlainExchangeRates);
router.route('/insta-wallet-to-wallet').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.instaWalletToWalletTransfer);
router.route('/insta-wallet-conversion').post(protect, authorize(['user']), WalletController.instaWalletToWalletConversion);
router.route('/insta-wallet-withdraw-by-admin').post(WalletController.instaWalletWithdrawByAdmin);
router.route('/insta-wallet-deposit-by-admin').post(WalletController.instaWalletDepositByAdmin);
router.route('/insta-wallet-conversion/limit-check').post(WalletController.instaConversionLimitCheck);

router.route('/proceed-w2w-transaction').post(protect, authorize(['user']), WalletController.formatW2WData);

router.route('/insta-payment-request-w2w').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.requestPaymentW2W);
router.route('/get-request-exchange-rate').post(WalletController.getExchangeRatesForRequest);
router.route('/accept-payment-request').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.acceptPaymentRequest);
router.route('/decline-payment-request/:request_id').get(WalletController.declinePaymentRequest);

router.route('/subcribe-payment-request-w2w').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.subscribeRequestPaymentW2W);
router.route('/schedule-payment-request-w2w').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.scheduleRequestPaymentW2W);
router.route('/subcribe-payment-request-w2w/:account_id').get(WalletController.getSubscribeRequestW2W);
router.route('/schedule-payment-request-w2w/:account_id').get(WalletController.getScheduleRequestW2W);

router.route('/subscribe-payment-w2w').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.subscribePaymentW2W);
router.route('/schedule-payment-w2w').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, WalletController.schedulePaymentW2W);
router.route('/subcribe-payment-w2w/:account_id').get(WalletController.getSubscribePaymentW2W);
router.route('/schedule-payment-w2w/:account_id').get(WalletController.getSchedulePaymentW2W);

router.route('/wallet-qrcode/:wallet_id').post(WalletController.getWalletQRCode);
router.route('/get-qr-details').post(AccountController.uploadDocumentsCheck.single("file"), WalletController.getQRWalletDetails)
router.route('/upload-qrcode').post(upload.single('qrCode'), WalletController.uploadWalletQRCode);
router.route('/update-qr-details').post(protect, authorize(['user']), WalletController.updateWalletQRCode);

router.route('/unblock-wallet-admin/:id').post(WalletController.unblockWalletByAdmin);
router.route('/block-wallet-admin/:id').post(WalletController.blockWalletByAdmin);
router.route('/unblock-wallet-user/:id').post(WalletController.unblockWalletByUser);
router.route('/block-wallet-user/:id').post(WalletController.blockWalletByUser);

router.route('/send-otp').post(protect, authorize(['user'], 'Transaction OTP'), WalletController.sendOtp);

router.route('/get-account-limits/:wallet_id').get(WalletController.getAccountLimits);

router.route("/get-all-wallets-temp").get(WalletController.getAllWallets);

router.route('/send-location-bot').post(WalletController.selectLocationForRequestPaymentBot);
router.route('/send-location-bot-telegram').post(WalletController.selectLocationForRequestPaymentTelegram);

router.route('/w2w-rates').get(protect, authorize(['user']), WalletController.w2wRates);

router.route('/get-wallet-details-public').post(WalletController.getWalletDetailsPublic);

module.exports = router;