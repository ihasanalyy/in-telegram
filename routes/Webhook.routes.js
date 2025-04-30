const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const WebhookController = require('../controllers/Webhook.controller');

router.route('/getid').post(WebhookController.getIdWebhook);
// router.route('/trustpayment').get(WebhookController.trustPayment);
router.route('/trustpayment').post(WebhookController.trustPayment);

router.route('/instagram').get(WebhookController.getInstagramNotification);
router.route('/instagram').post(WebhookController.setInstagramNotification);

router.route('/thunes-transaction-status').post(WebhookController.getThunesTransactionStatus);
router.route('/dtone-transaction-status').post(WebhookController.getDtoneTransactionStatus);

router.route('/set-schedule-calendar').post(WebhookController.setCalendarSchedule)
router.route('/set-subscription-calendar').post(WebhookController.setCalendarSubscription)
router.route('/set-subscription-calendar-end-date').post(WebhookController.setCalendarSubscriptionEndDate)

router.route('/set-schedule-payment-request').post(WebhookController.setPaymentRequestSchedule)
router.route('/set-subscription-payment-request').post(WebhookController.setPaymentRequestSubscription)
router.route('/set-subscription-request-end-date').post(WebhookController.setRequestSubscriptionEndDate)

// schedule routes for telegram
router.route('/set-schedule-telegram').post(WebhookController.setCalendarScheduleTelegram)

router.route('/thunes-accept-payment').get(WebhookController.thunesAcceptPayment)

router.route('/jw-player').post(WebhookController.getJWPlayer)

router.route('/telegram').post(WebhookController.getTelegramNotifications)

router.route('/vccdaddy').post(WebhookController.getVccdaddyNotifications)

router.route('/vespia').post(WebhookController.getVespiaNotifications)


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

module.exports = router;