const express = require('express');
const router = express.Router();
// console.log("admin Route Loaded");

const WalletController = require('../controllers/Wallet.controller');
const AccountController = require('../controllers/Account.controller');
const { protect, authorize, verifyOtp } = require('../middleware/auth');


router.route('/registration/individual').post(AccountController.individualAccountRegisteration);
router.route('/verify-registration/individual').post(AccountController.verifyIndividualAccountRegisteration);
router.route('/verify-email-registration/individual').post(AccountController.verifyEmailIndividualAccountRegisteration);
router.route('/registration/business').post(AccountController.businessAccountRegisteration);
router.route('/verify-registration/business').post(AccountController.verifyBusinessAccountRegisteration);
router.route('/registration/multiple').post(AccountController.multipleAccountRegisteration)
router.route('/account-check/individual').post(AccountController.individualAccountCheck);
router.route('/account-check/business').post(AccountController.businessAccountCheck);
router.route('/username-check').post(protect, authorize(['user']), AccountController.userNameCheck);

router.route('/auth/:token').get(AccountController.currentUser);
router.route('/login').post(AccountController.accountLogin);
router.route('/enable-2fa/:account_id').get(protect, authorize(['user']), AccountController.enable2fa);
router.route('/verify-2fa').post(protect, authorize(['user']), AccountController.verifyEnable2fa);
router.route('/tfa-settings/:account_id').put(protect, authorize(['user']), AccountController.updateTfaSettings);
router.route('/update-individual/:account_id').put(protect, authorize(['user']), AccountController.updateIndividualAccount);
router.route('/update-business/:account_id').put(protect, authorize(['user']), AccountController.updateBusinessAccount);
// router.route('/get-all-accounts/:limit/:skip').get(protect, authorize(['admin']), AccountController.getAllAccounts);
router.route('/get-all-accounts/:limit/:skip/:query?').get(protect, authorize(['admin']), AccountController.searchUsersAdmin);
router.route('/get-user-send-payment-request/:user_id').get(protect, authorize(['user']), AccountController.getUserSendPaymentRequest);
router.route('/get-user-receive-payment-request/:user_id').get(protect, authorize(['user']), AccountController.getUserReceivePaymentRequest);
router.route('/update-account-status/:account_id/:status').get(protect, authorize(['admin']), AccountController.updateAccountStatus);
router.route('/activate-account/:account_id').put(protect, authorize(['user']), AccountController.activateAccount);
router.route('/deactivate-account/:account_id').put(protect, authorize(['user']), AccountController.deactivateAccount);
router.route('/update-individual-by-admin/:account_id').put(protect, authorize(['admin']), AccountController.updateIndividualAccountByAdmin);
router.route('/update-business-by-admin/:account_id').put(protect, authorize(['admin']), AccountController.updateBusinessAccountByAdmin);
router.route('/update-account-setting/:account_id').put(protect, authorize(['admin']), AccountController.updateAccountSettings);
router.route('/update-username/:account_id').put(protect, authorize(['user']), AccountController.updateUsername);
router.route('/get-insta-link-code/:account_id').get(protect, authorize(['user']), AccountController.getInstaChatbotLinkCode);
router.route('/get-telegram-link-code/:account_id').get(protect, authorize(['user']), AccountController.getTelegramChatbotLinkCode);
router.route('/user-verification').post(protect, authorize(['user']), AccountController.userVerification);
router.route('/send-login-otp').post(AccountController.sendLoginOtp);
router.route('/verify-login-otp').post(AccountController.verifyLoginOtp);
router.route('/verify-login-auth').post(AccountController.verifyLoginAuth);


router.route('/send-forgot-password-otp').post(AccountController.sendForgotPasswordOtp);
router.route('/verify-forgot-password-otp').post(AccountController.verifyForgotPasswordOtp);
router.route('/reset-forgot-password').post(AccountController.resetForgotPassword);

router.route('/set-email-otp').post(protect, authorize(['user']), AccountController.sendEmailOtp);
router.route('/verify-email-otp').post(protect, authorize(['user']), AccountController.verifyEmailOtp);

router.route('/set-phone-otp').post(protect, authorize(['user']), AccountController.sendPhoneOtp);
router.route('/verify-phone-otp').post(protect, authorize(['user']), AccountController.verifyPhoneOtp);


// upload profile and cover
router.route('/upload-profile-image-by-token/:token').post(AccountController.uploadImageCheck.single("file"), AccountController.profileImageUploadByToken);
router.route('/upload-profile-image/:accountId').post(protect, authorize(['user']), AccountController.uploadImageCheck.single("file"), AccountController.profileImageUploader);
router.route('/upload-cover-image/:accountId').post(protect, authorize(['user']), AccountController.uploadImageCheck.single("file"), AccountController.coverImageUploader);
router.route('/delete-profile-picture/:accountId').delete(protect, authorize(['user']), AccountController.deleteProfileImage);
router.route('/delete-cover-picture/:accountId').delete(protect, authorize(['user']), AccountController.deleteCoverImage);

//upload user portfolio
router.route('/upload-portfolio/:accountId').post(protect, authorize(['user', 'admin']), AccountController.uploadDocumentsCheck.single("file"), AccountController.uploadDocuments)
router.route('/update-portfolio/:documentId').post(protect, authorize(['user', 'admin']), AccountController.uploadDocumentsCheck.single("file"), AccountController.updateSpecificDocument)
router.route('/delete-document/:documentId').delete(protect, authorize(['user', 'admin']), AccountController.deleteDocumentsFromPortfolio);
router.route('/get-all-document/:accountId').get(protect, authorize(['user', 'admin']), AccountController.getAllDocuments);
router.route('/get-specific-document/:documentId').get(protect, authorize(['user', 'admin']), AccountController.getSpecificDocumentDetails);

router.route('/delete-account/:account_id').delete(protect, authorize(['user']), AccountController.deleteAccount);
router.route('/delete-account-admin/:account_id').delete(protect, authorize(['admin']), AccountController.deleteAccountAdmin);
router.route('/change-password').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, AccountController.changePassword);
router.route('/set-password').post(protect, authorize(['user']), AccountController.setPassword);
router.route('/search-users/:query').get(protect, authorize(['user']), AccountController.searchUsers);
router.route('/set-search-users-checks').post(protect, authorize(['user']), AccountController.setSearchUserChecks);
router.route('/set-language').post(protect, authorize(['user']), AccountController.setLanguage);

router.route('/get-pending-reports/:account_id').get(protect, authorize(['user', 'admin']), AccountController.getQuotAndReportCount);

// timezones
router.route('/get-timezones/:country_iso_code').get(AccountController.getTimezones);
router.route('/get-all-timezones').get(AccountController.getAllTimezones);
router.route('/admin/get-requested-timezones').get(protect, authorize(['admin']), AccountController.requestedTimezones);
router.route('/request-timezone').post(protect, authorize(['user']), AccountController.requestTimezone);
router.route('/admin/accept-timezone-request').post(protect, authorize(['admin']), AccountController.acceptTimezoneRequest);

router.route('/get-social-media-details/:account_id').get(protect, authorize(['user']), AccountController.getSocialMediaDetails);
router.route('/get-social-media-details-public/:username').get(AccountController.getSocialMediaDetailsPublic);

router.route('/check-security-questions/:account_id').get(AccountController.securityQuestionCheck);

router.route('/get-jw-media-status').post(protect, authorize(['user']), AccountController.getJWMediaStatus);
router.route('/add-portfolio-item').post(protect, authorize(['user']), AccountController.addPortfolioItem);

router.route('/set-account-pin').post(protect, authorize(['user']), AccountController.setAccountPin)
router.route('/change-pin-status').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, AccountController.changePinStatus);
router.route('/change-pin').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, AccountController.changeAccountPin);
// router.route('/login/business').post(AccountController.businessAccountRegisteration);
// router.route('/login').post(AdminController.login);
// router.route('/auth/:token').get(AdminController.currentUser);
// router.route('/').get(AdminController.getAdmin);
// router.route('/').put(AdminController.updateAdmin);

router.route('/register-challenge').post(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, AccountController.registerChallenge);
router.route('/register-verify').post(AccountController.registerVerify);
router.route('/login-challenge').post(AccountController.loginChallenge);
router.route('/login-verify').post(AccountController.loginVerify);
router.route('/delete-challenge').put(protect, authorize(['user']), WalletController.uploadDocumentsCheck.array('files'), verifyOtp, AccountController.deleteChallenge);

router.route('/login-biometric-challenge').post(AccountController.loginBiometricChallenge);
router.route('/login-biometric-verify').post(AccountController.loginBiometricVerify);

router.route('/get-biometric-devices').post(AccountController.getBiometricDevices);
router.route('/delete-biometric-device').post(AccountController.removeBiometricDevice);
router.route('/enable-biometric-device').post(AccountController.enableDisableBiometricDevice);


module.exports = router;
