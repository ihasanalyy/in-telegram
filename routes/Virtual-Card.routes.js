const express = require("express")
const { createVirtualCardKYC,
    getPaypalFee,
    getFeeDetails,
    initiatPaypalTransaction,
    initiateTrustPaymentTransaction,
    trustPaymentVCCSavedCard,
    initiateTrustPaymentTransactionWOSavedCard,
    fetchAccountCards,
    getCardInfo,
    freeze,
    activate,
    getCardTransactions,
    cardToCardTransaction,
    getCardTopupFee,
    searchCards,
    walletToCardTransaction,
    createMastercardTransactionPaypal,
    createMastercardTransactionCard,
    updateCardEmail,
    cardToCardFee,
    createMastercardTransactionNewCard,
    trustPaymentVCCWOSavedCard
} = require("../controllers/Virtual-Card.controller")
const WalletController = require('../controllers/Wallet.controller')

const router = express.Router()

const { protect, authorize, verifyOtp, verifyIntlTopupOtp } = require('../middleware/auth');

router.route('/create-vvc').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, createVirtualCardKYC);
router.route('/get-user-vvc').get(protect, authorize(['user']), fetchAccountCards);
router.route('/get-card-details/:card_id').get(protect, authorize(['user']), getCardInfo);

router.route('/get-vvc-fee/:wallet_id/:cardType/:feeType').get(protect, authorize(['user']), getFeeDetails);

router.route('/initiate-vcc-paypal').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, initiatPaypalTransaction);

router.route('/initiate-vcc-pan-card').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyIntlTopupOtp, initiateTrustPaymentTransaction);

router.route('/confirm-vcc-pan-card/:transaction_id/:token').post(trustPaymentVCCSavedCard);

router.route('/initiate-vcc-card').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, initiateTrustPaymentTransactionWOSavedCard);
router.route('/confirm-vcc-card/:transaction_id/:token').post(trustPaymentVCCWOSavedCard);

router.route('/freeze').post(protect, authorize(['user']), freeze);

router.route('/activate').post(protect, authorize(['user']), activate);

router.route('/get-card-transcations').post(protect, authorize(['user']), getCardTransactions);

router.route('/card-to-card-transfer').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, cardToCardTransaction)
router.route('/card-to-card-fee').post(protect, authorize(['user']), cardToCardFee)

router.route('/get-card-topup-fee').post(protect, authorize(['user']), getCardTopupFee)

router.route('/wallet-to-card-transfer').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, walletToCardTransaction)
router.route('/topup-by-card').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, createMastercardTransactionCard)
router.route('/topup-by-new-card').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, createMastercardTransactionNewCard)
router.route('/topup-by-paypal').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, createMastercardTransactionPaypal)

router.route('/lookup').post(protect, authorize(['user']), searchCards)

router.route('/update-email').post(protect, authorize(['user']), updateCardEmail)

module.exports = router