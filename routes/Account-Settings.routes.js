const express = require('express');
const router = express.Router();
console.log("admin Route Loaded");

const AccountSettingsController = require('../controllers/Account-Settings.controller');

const { protect, authorize } = require('../middleware/auth');


router.route('/add-level-country').post(AccountSettingsController.addLevel);
router.route('/get-levet-details/:level_id').get(AccountSettingsController.getLevelDetails);
router.route('/get-all-level').get(AccountSettingsController.getAllLevels);
router.route('/get-individual-level').get(AccountSettingsController.getIndividualLevels);
router.route('/get-business-level').get(AccountSettingsController.getBusinessLevels);
router.route('/update-level/:level_id').put(AccountSettingsController.updateLevel);

router.route('/get-all-categories').get(AccountSettingsController.getAllCategories);
router.route('/get-business-categories').get(AccountSettingsController.getBusinessCategories);
router.route('/update-category/:category_id').put(AccountSettingsController.updateCategory);

router.route('/get-fee-list/:level_id').get(AccountSettingsController.getFeeList);
router.route('/get-country-fee-list/:country_id').get(AccountSettingsController.getReceiverFeeList);
router.route('/update-fee/:level_id').put(AccountSettingsController.updateFee);
router.route('/update-country-fee/:country_id').put(AccountSettingsController.updateReceiverFee);

module.exports = router;
