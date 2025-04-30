const express = require("express");
const router = express.Router();
const dtcontroller = require('../controllers/DT.controllers')
const WalletController = require('../controllers/Wallet.controller')
const { protect, authorize, verifyOtp } = require('../middleware/auth');

router.route("/countries").get(dtcontroller.getCountires)
router.route("/services-in-country/:isoCode").get(dtcontroller.getServicesByCountry)
router.route("/check-number/:number").get(protect, authorize(['user']), dtcontroller.getMobileNumberDetails)
router.route("/check-number-public").post(dtcontroller.getMobileNumberDetailsPublic)
router.route("/country-operators/:isoCode").get(dtcontroller.getCountryOperators)
router.route("/country-promotions/:isoCode").get(dtcontroller.getCountryPromotions)
router.route("/sub-services-in-country/:isoCode/:operator_id/:serviceId").get(dtcontroller.getSubservices)
router.route("/products/:isoCode/:operator_id/:serviceId/:subservice_id").post(dtcontroller.getProductsofSubservices)
router.route("/products/:product_id").post(dtcontroller.getPrice)
router.route("/create-transaction").post(protect, authorize(['user']), dtcontroller.transactions, WalletController.sendOtp)
router.route("/create-airtime-transaction").post(protect, authorize(['user']), dtcontroller.createAirtimeTransactions, WalletController.sendOtp)
// router.route("/confirm-airtime-transaction").post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, dtcontroller.confirmAirtimeTransaction)
router.route("/confirm-transaction").post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, dtcontroller.confirmtransaction)


router.route("/service-products/:isoCode/:operator_id/:serviceId/:subservice_id").post(protect, authorize(['user']), dtcontroller.getItemsFromSubServices)
router.route("/service-products-details/:wallet_id/:product_id").get(protect, authorize(['user']), dtcontroller.fetchItemDetails)
router.route("/rates").post(protect, authorize(['user']), dtcontroller.getRates)
router.route('/confirm-airtime-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, dtcontroller.createTransction);

router.route("/get-ranged-airtime-rates").post(protect, authorize(['user']), dtcontroller.fetchRangedAirtimeRates)
router.route('/confirm-ranged-airtime-transaction').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, dtcontroller.createTransctionRanged);

router.route("/get-esim-products").get(protect, authorize(['user']), dtcontroller.getEsimProducts)
router.route("/confirm-esim-transaction").post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, dtcontroller.confirmEsimTransaction)

module.exports = router;