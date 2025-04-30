const mongoose = require("mongoose")

const transactionNotes = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    note: { type: String, required: false },
    method: { type: String, required: false },
    language: { type: String, required: false },

}, { timestamps: true })

module.exports = mongoose.model("transactionNotes", transactionNotes)