const express = require('express');
const router = express.Router();
console.log("invitation routes working")

const waitlistController = require('../controllers/Waitlist.controller');

router.route('/add').post(waitlistController.addToWaitlist);
// router.route('/get-link-signup/:username').post(invitationController.invitedSignup);
// router.route('/get-referral/:userId').get(invitationController.getReferralGetUser);
// router.route('/get-company-referral/:companyId').get(invitationController.getReferralForCompany);
// router.route('/check-referral-code/:refCode').get(invitationController.referralCodeCheck);
// router.route('/ref-user-update').post(invitationController.referralCode);




module.exports = router;


// get 'api/invitation/get-link/:id'
// post 'api/invitation/get-link-signup/:username'
// get 'api/invitation/get-referral/:userId'
// get 'api/invitation/get-company-referral/:companyId'
// get 'api/invitation/check-referral-code/:refCode'
// post 'api/invitation/ref-user-update'