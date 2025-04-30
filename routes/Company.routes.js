const express = require('express');
const router = express.Router();

const PartnerController = require('../controllers/Partner.controller');
const CompanyController = require('../controllers/Company.controller')

const { protect, authorize } = require('../middleware/auth');


router.route('/get-partners/:account_id').get(PartnerController.getPartnersByAccountId);
router.route('/add-partner').post(PartnerController.addPartner);
router.route('/edit-partner').post(PartnerController.updatePartner);
router.route('/delete-partner/:account_id/:partner_id').delete(PartnerController.deletePartner);
router.route('/verification/:id').post(PartnerController.partnerVerification);
router.route('/verify-token/:token').get(PartnerController.verifyToken);

router.route('/upload-kyb-files').post(CompanyController.uploadDocumentsCheck.array('files'), CompanyController.uploadKYBFiles);
router.route('/update-kyb-verification-files-status/:account_id').post(CompanyController.updateKYBFilesStatus);

router.route('/set-additional-files-kyb/:account_id').post(CompanyController.kybAdditionalFilesAdmin);
router.route('/update-files-status-kyb/:account_id').post(CompanyController.updateKYBAddtnlFilesStatus);
router.route('/upload-additional-file-kyb/:account_id').post(CompanyController.uploadCheck.single('file'), CompanyController.uploadAdditionalFileKYB);
router.route('/get-additional-files-kyb/:account_id').get(CompanyController.getKYCAdditionalFilesKYB);
router.route('/delete-file-request-kyb/:account_id/:file_id').delete(CompanyController.deleteFileRequestKYB);

router.route('/set-additional-files-partner/:account_id/:partner_id').post(PartnerController.partnerAdditionalFilesAdmin);
router.route('/update-files-status-partner/:account_id/:partner_id').post(PartnerController.partnerUpdateFilesStatus);
router.route('/upload-additional-file-partner/:account_id/:partner_id').post(PartnerController.uploadCheck.single('file'), PartnerController.uploadPartnerAdditionalFilePartner);
router.route('/get-additional-files-partner/:account_id/:partner_id').get(PartnerController.getPartnerAdditionalFiles);
router.route('/delete-file-request-partner/:account_id/:partner_id/:file_id').delete(PartnerController.deletePartnerFileRequest);

router.route('/business-verification').post(CompanyController.businessRegisterationAdmin);


module.exports = router;