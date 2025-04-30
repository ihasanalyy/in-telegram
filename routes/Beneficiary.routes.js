const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const BeneficiaryController = require('../controllers/Beneficiary.controller');
const SwiftController = require('../controllers/Swift.controller');

const { protect, authorize } = require('../middleware/auth');
router.route('/add-beneficiary').post(BeneficiaryController.addBeneficiary);
router.route('/get-user-beneficiaries/:id').get(BeneficiaryController.getUserBeneficiaries);
router.route('/get-details/:id').get(BeneficiaryController.getBeneficiaryDetails);
router.route('/update-beneficiary/:beneficiary_id').put(BeneficiaryController.updateBeneficiary);
router.route('/delete-beneficiary/:beneficiary_id/:account_id').delete(BeneficiaryController.deleteBeneficiary);

router.route('/get-details-by-bic/:bic/:account_number').get(SwiftController.getDetailsBySwiftCode);
router.route('/get-details-by-iban/:iban').get(SwiftController.getDetailsByIban);

router.route('/get-coordinates/:countryIso').get(protect, authorize(['user']), BeneficiaryController.getCoordinates);
router.route('/get-autocomplete-address').get(protect, authorize(['user']), BeneficiaryController.getAutoCompleteAddress);

module.exports = router;