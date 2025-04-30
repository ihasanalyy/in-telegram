const mongoose = require('mongoose');

const collection = mongoose.Schema(
    {
        receiving_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        amount: { type: Number, required: false },
        currency: { type: String, required: false },
        status: { type: String, required: false },
        payment_method: { type: String, required: false },
        country_code: { type: String, required: false },
        paymentOrderId: { type: String, required: false },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('collection', collection);