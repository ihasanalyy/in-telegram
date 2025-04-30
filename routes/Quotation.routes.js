const express = require('express');
const router = express.Router();
const { protect, authorize, verifyOtp } = require('../middleware/auth');

const QuotationController = require('../controllers/Quotation.controller');
const WalletController = require('../controllers/Wallet.controller');

router.route('/create-quotation').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, QuotationController.createQuotation);
router.route('/get-quotation-by-reciever/:reciever_id').get(QuotationController.quotationByReciever);
router.route('/get-quotation-by-sender/:sender_id').get(QuotationController.quotationBySender);
router.route('/bargain').post(protect, authorize(['user']), QuotationController.bargain);
router.route('/accept-bargain').post(protect, authorize(['user']), QuotationController.acceptBargain);
router.route('/revise').post(protect, authorize(['user']), QuotationController.reviseQuotation);
router.route('/quotation-wallet-to-wallet').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, QuotationController.walletToWalletTransaction);
router.route('/decline-quotation/:quotation_id').delete(QuotationController.declineQuotation)


module.exports = router;
