const express = require('express');
const router = express.Router();
console.log("User Withdrawal")

const withdrawalController = require('../controllers/Withdrawal.controller');
const WalletController = require('../controllers/Wallet.controller')

const { protect, authorize } = require('../middleware/auth');

//Withdrawal channels routes
router.route('/create-withdrawal-channel-by-country').post(withdrawalController.addWithdrawalChannelsInCountry);
router.route('/update-withdrawal-channel-by-country').post(withdrawalController.updateWithdrawalChannelsInCountry);
router.route('/get-all-withdrawal-channels-by-country').get(withdrawalController.getAllCountryChannel);
router.route('/get-specific-withdrawal-channels-by-country').get(withdrawalController.getSpecificWithdrawalChannelCountry);

//Withdrawal routes
router.route('/create-withdrawal').post(withdrawalController.addWithdrawal);
router.route('/get-all-withdrawal/:id').get(withdrawalController.getUserWithdrawals);
router.route('/get-specific-withdrawal-details/:id').get(withdrawalController.getWithdrawalDetails);
router.route('/update-withdrawal/:withdrawal_id').post(withdrawalController.updateWithdrawal);
router.route('/delete-withdrawal/:withdrawal_id').delete(protect, authorize(['user', 'admin']), withdrawalController.deleteWithdrawal);
router.route('/set-channel-default').post(withdrawalController.setDefaultChannel);
router.route('/delete-channel-withdrawal').post(protect, authorize(['user', 'admin']), withdrawalController.deleteChannelFromWithdrawal);
// withdrawal amount
router.route('/get-withdrawal-channels/:country_iso_code').get(withdrawalController.getWithDrawalChannels);
router.route('/create-transaction/:quotation_id').post(protect, authorize(['user']), withdrawalController.createWithdrawalTransaction, WalletController.sendOtp);

router.route('/get-withdrawal-transactions/admin/:skip/:limit').get(withdrawalController.getAllWithdrawals);
router.route('/get-user-withdrawal-transactions/admin/:account_id/:skip/:limit').get(withdrawalController.getAllUserWithdrawals);



module.exports = router;