const express = require('express');
const router = express.Router();
console.log("invitation routes working")

const invitationController = require('../controllers/Invitation.controller');
const WalletController = require('../controllers/Wallet.controller');

const { protect, authorize, verifyOtp } = require('../middleware/auth');

router.route('/get-link/:id').get(invitationController.CreateInvitationLink);
router.route('/get-link-signup/:username').post(invitationController.invitedSignup);
router.route('/get-referral/:userId').get(invitationController.getReferralGetUser);
router.route('/get-company-referral/:companyId').get(invitationController.getReferralForCompany);
router.route('/check-referral-code/:refCode').get(invitationController.referralCodeCheck);
router.route('/ref-user-update').post(invitationController.referralCode);
router.route('/get-user-commissions/:userId').get(invitationController.getUserCommissions);
router.route('/move-commissions').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, invitationController.moveCommissionToAccount);
router.route('/invite-user/:account_id/:type').post(protect, authorize(['user']), invitationController.inviteUserToInstapay);

router.route('/request-commission-withdrawal').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, invitationController.requestWithdrawalCommission);
// router.route('/create-request-transaction').post(invitationController.createWithdrawalTransaction);
router.route('/accept-withdrawal-request').post(invitationController.acceptExternalCommissionRequest);
router.route('/decline-withdrawal-request').post(invitationController.declineExternalCommissionRequest);
router.route('/get-all-withdrawal-requests/:skip/:limit').get(invitationController.fetchAllWithdrawalRequests);
router.route('/get-user-withdrawal-requests/:account_id/:skip/:limit').get(invitationController.fetchUserWithdrawalRequests);

router.route('/get-withdrawal-rates/:from/:level_id/:amount/:receiver_wallet_id').get(invitationController.commissionRates)

module.exports = router;


// get 'api/invitation/get-link/:id'
// post 'api/invitation/get-link-signup/:username'
// get 'api/invitation/get-referral/:userId'
// get 'api/invitation/get-company-referral/:companyId'
// get 'api/invitation/check-referral-code/:refCode'
// post 'api/invitation/ref-user-update'