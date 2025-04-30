const express = require('express')
const router = express.Router()
const { protect, authorize, verifyOtp } = require('../middleware/auth');
const userPreferenceController = require('../controllers/User-Payment-Preference.controller')

router.route('/update-preferences/:account_id').put(protect, authorize(['user']), userPreferenceController.validatePreferences, userPreferenceController.updatePreferences)
router.route('/get-preferences/:account_id/:isoCode').get(protect, authorize(['user']), userPreferenceController.getUserPrefernces)
router.route('/get-user-preferences/:account_id').get(protect, authorize(['user']), userPreferenceController.getPreferences)

module.exports = router