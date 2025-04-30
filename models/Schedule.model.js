const mongoose = require('mongoose');
const RequestReviewModel = require('./RequestReview.model');

const schedule = mongoose.Schema(
    {
        // schedule: { type: Number, required: false },
        date: { type: String, required: false },
        next_date: { type: String, required: false },
        time: { type: String, required: false },
        timezone: { type: String, required: false },
        cycles: { type: Number, required: false },
        nextCycles: { type: Number, required: false },
        untilIstop: { type: Boolean, required: false },
        reserved: { type: Boolean, required: false },
        type: { type: String, required: false },
        recursive: { type: Boolean, required: false },
        status: { type: String, required: false },
        active: { type: Boolean, required: false },
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
        request_payment: {
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
        },
        payment: {
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
            }
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        lastReminderSent: { type: Date, required: false },
        lat: { type: String, required: false },
        long: { type: String, required: false },
        display_name: { type: String, required: false },
        address: { type: Object, required: false },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('schedule', schedule);