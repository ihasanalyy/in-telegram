const express = require('express');
const router = express.Router();

const PaymentAddressController = require('../controllers/PaymentAddress.controller')
const { protect, authorize, verifyOtp } = require('../middleware/auth');

router.route('/get-payment-address/:username').get(protect, authorize(['user']), PaymentAddressController.getPaymentAddress)
router.route('/add-payment-address/:username').post(PaymentAddressController.addPaymentAddressDetails)
router.route('/get-payment-address-public/:username').get(PaymentAddressController.getPaymentAddressPublic)
router.route('/update-payment-address-status/:username').post(PaymentAddressController.updatePaymentAddressStatus)
router.route('/update-payment-address-status-user/:username').post(PaymentAddressController.updatePaymentAddressStatusUser)
router.route('/get-payment-address-status/:username').get(PaymentAddressController.getPaymentAddressStatusAdmin)
router.route('/add-payment-address-profile/:username').post(PaymentAddressController.uploadCheck.single('file'), PaymentAddressController.addPaymentAddressProfile)
router.route('/add-payment-address-cover/:username').post(PaymentAddressController.uploadCheck.single('file'), PaymentAddressController.addPaymentAddressCover)

module.exports = router;
