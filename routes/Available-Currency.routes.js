const express = require('express');
const router = express.Router();
console.log("av currency Route Loaded");

const availableCurrency = require('../controllers/Available-Currency.controller')
const requestCurrency = require('../controllers/Requested-Currency.controller')

const { protect, authorize } = require('../middleware/auth');


router.route('/add-currency').post(protect, authorize(['admin']), availableCurrency.addCurrencyAdmin)
router.route('/delete-currency/:currency_id').delete(protect, authorize(['admin']), availableCurrency.deleteCurrencyAdmin)
router.route('/get-currencies').get(protect, authorize(['user', 'admin']), availableCurrency.getAllCurrencies)

router.route('/request-currency-user/:currency_id').post(requestCurrency.requestCurrency)
router.route('/accept-currency-request/:account_id/:currency_id').post(protect, authorize(['admin']), requestCurrency.acceptCurrencyRequest)
router.route('/get-requested-currencies').get(protect, authorize(['admin']), requestCurrency.getAllRequestedCurrencies)
router.route('/update-requested-currency-status/:requested_currency_id/:account_id').post(protect, authorize(['admin']), requestCurrency.statusCurrencyRequest)
router.route('/delete-requested-currency/:requested_currency_id/:account_id').delete(protect, authorize(['admin']), requestCurrency.deleteCurrencyRequest)


module.exports = router;