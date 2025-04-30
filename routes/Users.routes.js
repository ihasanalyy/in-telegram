const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const UserController = require('../controllers/Users.controller');
const WalletController = require('../controllers/Wallet.controller');

const { protect, authorize, verifyOtp } = require('../middleware/auth');

router.route('/verification/:id').post(UserController.userVerification);
router.route('/get-security-question').get(protect, authorize(['user']), UserController.getSecurityQuestion);
router.route('/set-security-question/:account_id').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, UserController.setSecurityQuestion);
router.route('/set-security-question-no-otp/:account_id').post(protect, authorize(['user']), UserController.setSecurityQuestion);
router.route('/set-additional-files/:account_id').post(UserController.kycAdditionalFilesAdmin);
router.route('/update-files-status/:account_id').post(UserController.kycUpdateFilesStatus);
router.route('/upload-additional-file/:account_id').post(UserController.uploadCheck.single('file'), UserController.uploadAdditionalFile);
router.route('/get-additional-files/:account_id').get(UserController.getKYCAdditionalFiles);
router.route('/delete-file-request/:account_id/:file_id').delete(UserController.deleteFileRequest);



// router.route('/login').post(UserController.login);
// router.route('/auth/:token').get(UserController.currentUser);
// router.route('/list').get(UserController.getAllUsers);
// router.route('/details/:id').get(UserController.getUser);
// router.route('/sendMailCode').post(UserController.sendMailCode);
// router.route('/verifyMailCode').post(UserController.verifyMailCode);
// router.route('/sendCode').post(UserController.sendCode);
// router.route('/verifyCode').post(UserController.verifyCode);
// router.route('/').put(UserController.updateUser);
// router.route('/resetPassword').put(UserController.resetUserPassword);
// router.route('/:id').delete(UserController.deleteUser);
// router.route('/:id').delete(UserController.deleteUser);

router.route('/get-user-details/:username').get(UserController.getUserDetails);
router.route('/get-user-profile/:username').get(UserController.getUserProfile);
router.route('/get-user-cover/:username').get(UserController.getUserCoverImage);
router.route('/get-default-wallet/:username').get(UserController.getUserDefaultWallet);
router.route('/get-user-reviews/:username/:user_type/:skip/:limit').get(UserController.getUserReviews);
router.route('/get-user-documents/:username/:skip/:limit').get(UserController.getUserDocuments);
router.route('/get-profile-completion/:account_id').get(UserController.getUserProfileCompletion);

router.route('/get-account-information/:account_id').get(protect, authorize(['admin']), UserController.getAccountDetails);
router.route('/cancel-schedule/:scheduleId').get(UserController.cancelSchedule);

router.route('/charge-kyc').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, UserController.chargeKYCAmount);
router.route('/update-kyc-status/admin').post(protect, authorize(['admin']), UserController.updateKYCStatus);
router.route('/add-source-of-funds').put(protect, authorize(['user']), UserController.updateSourceOfFunds);
module.exports = router;