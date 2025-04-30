const express = require('express');
const router = express.Router();

const NotificationController = require('../controllers/Notification.controller')

router.route('/get-notifications/:account_id').get(NotificationController.getNotificationsReciever);
router.route('/update-notification-status/:notification_id').get(NotificationController.updateNotificationStatus);

router.route('/get-notifications-admin').get(NotificationController.getNotificationsAdmin);
router.route('/update-notification-status-admin/:notification_id').get(NotificationController.updateNotificationStatusAdmin);
module.exports = router;

