const express = require('express');
const router = express.Router();

const NomineeController = require('../controllers/Nominee.controller')

router.route('/add-nominee/:account_id').post(NomineeController.uploadCheck.single('file'), NomineeController.addNominee)
router.route('/update-nominee/:account_id').post(NomineeController.uploadCheck.single('file'), NomineeController.updateNominee)
router.route('/delete-nominee/:account_id').get(NomineeController.deleteNominee)
router.route('/get-nominee/:account_id').get(NomineeController.getNomineeDetails)


module.exports = router;