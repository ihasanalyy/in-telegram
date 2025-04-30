const express = require('express');
const router = express.Router();
console.log("white listed ready")

const CountryController = require('../controllers/Country.controller');
const { protect, authorize } = require('../middleware/auth');


router.route('/get-all-country').get(protect, authorize(['admin']), CountryController.getAllWhiteListedCountry);
router.route('/get-all-receiving-country').get(CountryController.getAllReceivingCountry);
router.route('/get-individual-registration-countries').get(CountryController.getIndividualRegistrationCountries);
router.route('/get-business-registration-countries').get(CountryController.getBusinessRegistrationCountries);
router.route('/get-all-public-countries').get(CountryController.getAllActiveCountry);
router.route('/get-all-active-country').get(CountryController.getAllActiveCountry);
router.route('/country-add-to-whitelist').post(protect, authorize(['admin']), CountryController.CountryAddToWhiteList);
router.route('/update-country-settings/:country_id').put(protect, authorize(['admin']), CountryController.updateCountrySettings);
router.route('/delete-country/:country_id').delete(protect, authorize(['admin']), CountryController.deleteCountry);
router.route('/get-specific-country-details/:country_id').get(protect, authorize(['admin', 'user']), CountryController.getSpecificCountryDetails);
router.route('/get-specific-country-details-public/:country_id').get(CountryController.getSpecificCountryDetailsPublic);



module.exports = router;