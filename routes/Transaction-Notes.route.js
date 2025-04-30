const express = require("express");
const router = express.Router();

const { protect, authorize, verifyOtp } = require('../middleware/auth');

const notesController = require('../controllers/Transaction-Notes.controller')

router.route("/add-note").post(protect, authorize(['admin']), notesController.addNote)
router.route("/get-notes").get(protect, authorize(['user', 'admin']), notesController.getNotes)
router.route("/delete-note/:id").delete(protect, authorize(['admin']), notesController.deleteNote)
router.route("/get-all-notes").get(protect, authorize(['admin']), notesController.getAllNotes)

module.exports = router;

