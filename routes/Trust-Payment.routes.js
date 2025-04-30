const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const TrustPaymentController = require('../controllers/Trust-Payment.controller');
const WalletController = require('../controllers/Wallet.controller');

const { handleAttachments } = require('../utils/helpers');
const { protect, authorize, verifyTopupW2WOtp, verifyIntlTopupOtp } = require('../middleware/auth');
const { confirmTransactionTopupHelper } = require('../utils/InstaChatbotHelpers');
// const { protect, authorize } = require('../middleware/auth');

router.route('/get-tbc-fee/:wallet_id/:amount').get(protect, authorize(['user']), TrustPaymentController.getTopupByCardFee);

// topup without saved card
router.route('/initiat-transaction').post(protect, authorize(['user']), TrustPaymentController.initiatTrustPaymentTransaction);
router.route('/payment-confirmation/:transaction_id').post(TrustPaymentController.trustPaymentConfirmation);

// kyc
router.route('/initiat-kyc-transaction').post(protect, authorize(['user']), TrustPaymentController.initiatKYCTrustPaymentTransaction);
router.route('/payment-kyc-confirmation/:transaction_id').post(TrustPaymentController.trustPaymentKYCConfirmation);

router.route('/initiat-kyc-pan-transaction').post(protect, authorize(['user']), TrustPaymentController.initiatTrustPaymentKYCTransactionWithSaveCard);

// topup with saved card
router.route('/initiat-pan-transaction').post(protect, authorize(['user']), TrustPaymentController.initiatTrustPaymentTransactionWithSaveCard);
router.route('/confirm-pan-transaction/:transaction_id').post(TrustPaymentController.confirmTrustPaymentTransactionWithSaveCard);

// w2w transaction without saved cards
router.route('/initiat-w2w-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyTopupW2WOtp, handleAttachments, TrustPaymentController.initiatTrustPaymentW2WTransaction);
// router.route('/initiat-w2w-transaction').post(TrustPaymentController.initiatTrustPaymentW2WTransaction);
router.route('/w2w-payment-confirmation/:transaction_id/:token').post(TrustPaymentController.trustPaymentW2WConfirmation, WalletController.formatW2WData);

// w2w transaction with saved cards
router.route('/initiat-w2w-pan-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyTopupW2WOtp, handleAttachments, TrustPaymentController.initiatTrustPaymentW2WTransactionSavedCard);
router.route('/w2w-pan-payment-confirmation/:transaction_id/:token').post(TrustPaymentController.trustPaymentW2WConfirmationSavedCard, WalletController.formatW2WData);

router.route('/payment-page').get(TrustPaymentController.trustpaymentPage);
router.route('/get-user-pan-list/:account_id').get(TrustPaymentController.getUserPanList);
router.route('/delete-user-pan/:id').delete(TrustPaymentController.deletePan);

// international with saved cards
router.route('/initiat-international-pan-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyIntlTopupOtp, TrustPaymentController.initiatTrustPaymentTransactionWithSaveCardIntl);
router.route('/confirm-international-pan-transaction/:transaction_id/:token').post(TrustPaymentController.confirmTrustPaymentTransactionWithSaveCardIntl);

// international without saved cards
router.route('/initiat-international-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyIntlTopupOtp, TrustPaymentController.initiatTrustPaymentTransactionIntl);
router.route('/confirm-international-transaction/:transaction_id/:token').post(TrustPaymentController.trustPaymentConfirmationIntl);

// airtime with saved cards
// router.route('/confirm-airtime-pan-transaction/:transaction_id/:token/:type').post(TrustPaymentController.confirmTrustPaymentAirtimeTransactionWithSaveCard);

// airtime without saved cards
// router.route('/confirm-airtime-transaction/:transaction_id/:token/:type').post(TrustPaymentController.trustPaymentConfirmationAirtime);

// topup on chatbot with saved card
router.route('/confirm-chatbot-pan-topup/:transaction_id').post(TrustPaymentController.confirmTopupChatbotWebhook);

// w2w topup on chatbot saved card
router.route('/confirm-chatbot-w2w-pan-topup/:transaction_id/:token').post(TrustPaymentController.confirmW2WTopupChatbotWebhook, WalletController.formatW2WDataChatbot);
router.route('/confirm-chatbot-w2w-pan-topup-telegram/:transaction_id/:token').post(TrustPaymentController.confirmW2WTopupChatbotWebhookTelegram, WalletController.formatW2WDataChatbotTelegram);

// intl topup on chatbot saved card
router.route('/confirm-chatbot-intl-pan-topup/:transaction_id/:token').post(TrustPaymentController.confirmIntlTopupChatbotWebhook, confirmTransactionTopupHelper);
router.route('/confirm-chatbot-intl-pan-topup-telegram/:transaction_id/:token').post(TrustPaymentController.confirmIntlTopupChatbotTelegramWebhook, confirmTransactionTopupHelper);

// airtime without saved cards
router.route('/initiate-airtime-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyIntlTopupOtp, TrustPaymentController.initiatTrustPaymentTransactionAirtime);
router.route('/confirm-airtime-transaction/:transaction_id').post(TrustPaymentController.trustPaymentAirtimeConfirmation);

// airtime with saved card
router.route('/initiate-pan-airtime-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyIntlTopupOtp, TrustPaymentController.initiateAirtimeTransactionSavedCard);
router.route('/confirm-pan-airtime-transaction/:transaction_id').post(TrustPaymentController.trustPaymentAirtimeConfirmationSavedCard);

// airtime with saved card - chatbot
router.route('/confirm-chatbot-pan-airtime-topup/:transaction_id').post(TrustPaymentController.confirmAirtimeChatbotWebhook);
router.route('/confirm-chatbot-pan-airtime-topup-telegram/:transaction_id').post(TrustPaymentController.confirmAirtimeChatbotWebhookTelegram);

// VCC topup
router.route('/confirm-chatbot-vcc-topup-telegram/:transaction_id/:token').post(TrustPaymentController.confirmVCCTopupWithSaveCardTelegram);
router.route('/confirm-chatbot-vcc-topup-instagram/:transaction_id/:token').post(TrustPaymentController.confirmVCCTopupWithSaveCardInstagram);
router.route('/confirm-chatbot-vcc-topup/:transaction_id/:token').post(TrustPaymentController.confirmVCCTopupWithSaveCard);
router.route('/confirm-vcc-topup/:transaction_id/:token').post(TrustPaymentController.confirmVCCTopupWithOutSaveCard);

// check card expiry
router.route('/check-card-expiry').post(protect, authorize(['user']), TrustPaymentController.checkCardExpiry);

module.exports = router;