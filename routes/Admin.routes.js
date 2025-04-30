const express = require('express');
const router = express.Router();
console.log("admin Route Loaded");

const AdminController = require('../controllers/Admin.controller');

const { protect, authorize } = require('../middleware/auth');


router.route('/').post(AdminController.setAdmin);
router.route('/login').post(AdminController.login);
router.route('/auth/:token').get(AdminController.currentAdmin);
router.route('/details/:admin_id').get(protect, authorize(['admin']), AdminController.getAdminDetails);
router.route('/').get(protect, authorize(['admin']), AdminController.getAdmin);
router.route('/:admin_id').put(protect, authorize(['admin']), AdminController.updateAdmin);
router.route('/:admin_id').delete(protect, authorize(['admin']), AdminController.deleteAdmin);


module.exports = router;
