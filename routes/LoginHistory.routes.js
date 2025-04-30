const express = require('express');
const router = express.Router();
console.log("Login History")

const LoginHistoryController = require('../controllers/Login-History.controller');

const { protect, authorize } = require('../middleware/auth');


router.route('/create-login-history').post(LoginHistoryController.createLoginHistory);
router.route('/get-user-login-history/:acountId').get(protect, authorize(['admin', 'user']), LoginHistoryController.getLoginHistory);

module.exports = router