const express = require("express");
const router = express.Router()
console.log("loaded")

const whitelevelController = require('../controllers/Whitelevel.controller')


router.route("/get-countries").get(whitelevelController.getAllCountries)
router.route("/get-services/:country_iso_code").get(whitelevelController.getAllServices)
router.route("/get-channels/:service_id/:iso_code").get(whitelevelController.getChannels)
router.route("/get-payer-rates/:payer_id").post(whitelevelController.getThunesRates)
router.route("/create-quotation").post(whitelevelController.createQuotation)


module.exports = router;