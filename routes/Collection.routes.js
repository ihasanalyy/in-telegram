const express = require('express')
const router = express.Router();

const CollectionController = require('../controllers/Collection.controller')

const { protect, authorize } = require('../middleware/auth');


router.route('/create-payment').post(CollectionController.createOrder);
router.route('/get-collection-details/:collection_id').get(CollectionController.getCollectionDetails);
router.route('/get-collection-payment-details/:collection_id').get(CollectionController.getPaymentDetails);
router.route('/collection-charge/:collection_id').post(CollectionController.charge);
router.route('/get-user-funds/:account_id').get(CollectionController.getUserFunds);
router.route('/get-all-funds').get(CollectionController.getAllFunds);

// thunes accept
router.route('/create-payment-thunes-accept').post(CollectionController.createPayment);

// airtime accept
router.route('/create-payment-airtime-accept').post(CollectionController.createPaymentAirtime);

// collection details
router.route('/get-services/:iso_code').get(CollectionController.getServices);
router.route('/get-payers/:iso_code/:service').get(CollectionController.getPayers);
router.route('/get-rates').post(CollectionController.getCollectionTopupRates);
router.route('/create-payment-order').post(CollectionController.createTopupPaymentOrder);

module.exports = router;
