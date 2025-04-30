const mongoose = require("mongoose")

const logSchema = new mongoose.Schema({
    error: { type: String, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'account' },
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'transaction' },
    date: { type: Date, default: Date.now },
    type: { type: String, required: false },
    additionalInfo: { type: Object }
})

module.exports = mongoose.model('Log', logSchema);
