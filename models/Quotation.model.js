const mongoose = require('mongoose');

const quotation = mongoose.Schema(
    {
        reference_id: { type: String, required: false },
        title: { type: String, required: false },
        desc: { type: String, required: false },
        amount: { type: Number, required: false },
        revised_amount: { type: Number, required: false },
        bargain: { type: Boolean, required: false },
        amount_sender_currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        amount_reciever_currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        // currency
        images: [
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
        status: { type: String, required: false },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        reciever: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        type: { type: String, required: false },
        decline_status: { type: String, required: false },
        createdAt: { type: Date, default: Date.now }
    });

module.exports = mongoose.model('quotation', quotation);