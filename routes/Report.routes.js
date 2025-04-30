const express = require('express');
const router = express.Router();

const ReportController = require('../controllers/Report.controller')

const { protect, authorize } = require('../middleware/auth');

router.route('/add-report/:from/:to').post(ReportController.createReport)
router.route('/update-report-status/:report_id').post(ReportController.updateReportStatus)
router.route('/get-reports').get(ReportController.getReports)
router.route('/get-reports-by-reporter/:reporter_id').get(ReportController.getReportsByReporter)
router.route('/get-reports-by-reported/:reported_id').get(ReportController.getReportsByReported)
router.route('/get-report/:report_id').get(ReportController.getReportByReportId)
router.route('/get-report-status/:reporter_id/:username').get(ReportController.checkReportStatus)




module.exports = router;