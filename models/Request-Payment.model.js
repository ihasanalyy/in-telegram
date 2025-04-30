const mongoose = require('mongoose');

const request_payment = mongoose.Schema(
    {
        reference_id: { type: String, required: false },
        service_type: { type: String, required: false },
        status: { type: String, required: false },
        attachments: [
            {
                key: {
                    type: String,
                    required: false
                },
                url: {
                    type: String,
                    required: false
                },
                ETag: {
                    type: String,
                    required: false
                }
            },
        ],
        description: { type: String, required: false },
        purpose: { type: String, required: false },
        currency: {
            code: { type: String, required: false },
            symbol: { type: String, required: false }
        },
        amount: { type: Number, required: false },
        wallet_id: { type: String, required: false },
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        seller_comment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "request_review",
            required: false,
        },
        buyer_comment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "request_review",
            required: false,
        },
        lat: { type: String, required: false },
        long: { type: String, required: false },
        display_name: { type: String, required: false },
        address: { type: Object, required: false },

        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('request_payment', request_payment);