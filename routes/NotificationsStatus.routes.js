const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const NotificationStatusController = require('../controllers/NotificationsStatus.controller')

router.route('/set-notifications/:account_id').post(NotificationStatusController.updateNotificationsStatus);
router.route('/get-notifications/:account_id').get(NotificationStatusController.getNotificationsStatus);

module.exports = router;
