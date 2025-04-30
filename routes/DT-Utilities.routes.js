const express = require("express");
const router = express.Router();
const dt_utilities_controller = require('../controllers/DT-Utilities.controller')

router.route("/utilities-services-in-country/:isoCode").get(dt_utilities_controller.getSubservices)
router.route("/products-utilities/:isoCode/:subservice_id").post(dt_utilities_controller.getProductsofSubservices)
router.route("/create-transaction").post(dt_utilities_controller.createTransaction)
router.route("/statement_inquiry").post(dt_utilities_controller.statemnet_inquiry)



module.exports = router;
