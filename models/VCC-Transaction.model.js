const mongoose = require('mongoose');

const vcc_transaction = mongoose.Schema({
    cardNo: { type: String, required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: false },
    authCode: { type: String, required: false },
    transactionId: { type: String, required: false },
    billAmount: { type: Number, required: false },
    txAmount: { type: Number, required: false },
    fee: { type: Number, required: false },
    currency: { type: String, required: true },
    merchantName: { type: String, required: false },
    merchantCategory: { type: String, required: false },
    merchantCountry: { type: String, required: false },
    status: { type: String, required: true },
    reason: { type: String, required: false },
    type: { type: String, required: true },
    transaction_type: { type: String, required: true },
    receiverCard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "virtualCard",
        required: false
    },
    senderCard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "virtualCard",
        required: false
    },
    timeline: [
        {
            date: { type: Date, required: false },
            status: { type: String, required: false },
        }
    ],
    external_token: {
        token: { type: String, required: false },
        type: { type: String, required: false },
    },
    is_card_save: { type: Boolean, required: false },

}, { timestamps: true });

module.exports = mongoose.model('vcc_transaction', vcc_transaction);