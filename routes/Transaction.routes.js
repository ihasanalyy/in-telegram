const express = require('express');
const router = express.Router();
console.log("User Route Loaded");

const TransactionController = require('../controllers/Transaction.controller');
const ReviewController = require('../controllers/Request-Review.controller');

const { protect, authorize } = require('../middleware/auth');

router.route('/search-transactions/:skip/:limit/:query').get(TransactionController.searchTransaction);
router.route('/search-account-transactions/:account_id/:skip/:limit/:query').get(TransactionController.searchAccountTransaction);

router.route('/search-transactions-by-date/:skip/:limit').post(TransactionController.searchTransactionByDate);
router.route('/search-account-transactions-by-date/:account_id/:skip/:limit').post(TransactionController.searchAccountTransactionByDate);
router.route('/search-account-transactions-by-date-type/:account_id/:skip/:limit').post(TransactionController.getTransactionsByServiceType);

router.route('/get-all-transactions/:skip/:limit').get(TransactionController.getAllTransaction);
router.route('/account-transactions/:account_id/:skip/:limit').get(TransactionController.getUserTransaction);

router.route('/get-all-transactions-by-wallet/:wallet_id/:skip/:limit').get(TransactionController.getAllTransactionByWallet);
router.route('/search-account-transactions-wallet-by-date/:walletId/:skip/:limit').post(TransactionController.getWalletTransactionByDate);
router.route('/search-wallet-transactions/:wallet_id/:skip/:limit/:query').get(TransactionController.searchWalletTransaction);

router.route('/add-category').post(TransactionController.addUserTransactionCategory);
router.route('/get-category/:account_id').get(TransactionController.getUserTransactionCategory);
router.route('/edit-category').put(TransactionController.editUserTransactionCategory);
router.route('/delete-category').delete(TransactionController.deleteUserTransactionCategory);
router.route('/get-all-user-categories/:account_id').get(TransactionController.getAllUserTransactionCategory);

router.route('/add-category-admin').post(TransactionController.addAdminTransactionCategory);
router.route('/edit-category-admin').put(TransactionController.editAdminTransactionCategory);
router.route('/delete-category-admin').delete(TransactionController.deleteAdminTransactionCategory);
router.route('/get-categories-admin').get(TransactionController.getAdminTransactionCategory);
router.route('/get-categories-admin/:account_id').get(TransactionController.getUserTransactionCategoryByUser);

router.route('/get-transactions-admin/:skip/:limit').post(TransactionController.getTransactionsAdmin);

router.route('/get-service-transactions/:service_name/:account_id/:skip/:limit').get(TransactionController.searchTransactionsBasedOnType);

router.route('/get-transactions-by-country-user/:account_id').get(TransactionController.getUserTransactionsByCountry)
router.route('/get-transactions-report-user/:skip/:limit').post(TransactionController.getUserTransactionsReport);

router.route('/add-buyer-to-seller-review').post(ReviewController.buyerToSellerReview)
router.route('/add-seller-to-buyer-review').post(ReviewController.sellerToBuyerReview)
router.route('/reply-to-buyer').post(ReviewController.sellerToBuyerReply)
router.route('/get-seller-reviews/:seller_id/:skip/:limit').get(ReviewController.getReviewsBySeller)
router.route('/get-request-reviews/:request_id').get(ReviewController.getReviewsByRequest)
router.route('/update-review').post(ReviewController.updateReview)
router.route('/update-reply').post(ReviewController.updateReply)
router.route('/delete-review/:review_id').delete(ReviewController.deleteReview)
router.route('/delete-reply/:review_id').delete(ReviewController.deleteReply)

router.route('/fail-transaction').post(TransactionController.failTransaction)

router.route('/add-transactions-category').post(TransactionController.addTransactionsByCategory)

router.route('/get-all-transactions').post(TransactionController.getAllTransactions)

router.route('/get-account-transactions').post(TransactionController.getAccountTransactions)


module.exports = router;