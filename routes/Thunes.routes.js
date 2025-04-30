const express = require("express");
const router = express.Router();

const thunesController = require('../controllers/Thune.controller')
const WalletController = require('../controllers/Wallet.controller')

const { protect, authorize, verifyOtp } = require('../middleware/auth');


router.route("/balance").get(protect, authorize(['user']), thunesController.getBalances)
router.route("/get-balance").post(protect, authorize(['user']), thunesController.getThunesBalanceInCurrency)
router.route("/countries").get(thunesController.getCountries)
router.route("/services/:country_iso_code").get(thunesController.getServices)
router.route("/payerInfo").post(thunesController.getPayerInfo)
router.route("/get-rates/:payerId").post(thunesController.getExchangeRates)
router.route("/createQuotation").post(thunesController.createQuotationNew)
router.route("/createTransaction/:Quotation_ID").post(protect, authorize(['user']), thunesController.createTransaction, WalletController.sendOtp)
router.route("/confirmTransaction").post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, thunesController.confirmTransaction)
router.route("/getStatus/:transactionId").get(thunesController.getStatus)
router.route("/get-required-fields-by-country/:country_iso_code/:service_id/:transaction_type").get(protect, authorize(['user']), thunesController.getRequiredFieldsByCountry)

router.route("/confirm-transaction-topup").post(protect, authorize(['user']), thunesController.confirmTransactionTopup)

// 
router.route("/get-markup-conversion-rates").get(thunesController.getMarkupExchangeRate)
router.route("/get-rates-new/:payerId").post(thunesController.getIntlFX)
router.route("/create-quotation").post(thunesController.createQuotationNew1)
router.route("/get-payer-details").get(thunesController.getPayerRatesInfo)

router.route("/get-withdrawal-rates/:payerId").post(thunesController.getWithdrawalFX)




module.exports = router;

