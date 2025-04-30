const mongoose = require('mongoose');

const payment = mongoose.Schema(
    {
        reference_id: { type: String, required: false },
        service_type: { type: String, required: false },
        status: { type: String, required: false },
        description: { type: String, required: false },
        purpose: { type: String, required: false },
        currency: {
            code: { type: String, required: false },
            symbol: { type: String, required: false }
        },
        amount: { type: Number, required: false },
        sender_wallet_id: { type: String, required: false },
        sender_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        reciever_wallet_id: { type: String, required: false },
        reciever_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('payment', payment);