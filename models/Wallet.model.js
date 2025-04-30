const mongoose = require('mongoose');
const RequestReviewModel = require('./RequestReview.model');

const wallet = mongoose.Schema(
    {
        wallet_id: { type: String, required: false },
        wallet_type: { type: String, required: false },
        status: { type: String, required: false },
        admin_blocked: { type: Boolean, required: false }, // by admin
        blocked: { type: Boolean, required: false },
        default: { type: Boolean, required: false },
        account_type: { type: String, required: false },
        currency: {
            code: { type: String, required: false },
            symbol: { type: String, required: false }
        },
        balance: {
            available: {
                type: Number, required: false, validate: {
                    validator: function (v) {
                        return v >= 0;
                    },
                    message: props => `${props.value} is not a valid amount! Amount cannot be negative.`
                }
            },
            pending: {
                type: Number, required: false, validate: {
                    validator: function (v) {
                        return v >= 0;
                    },
                    message: props => `${props.value} is not a valid amount! Amount cannot be negative.`
                }
            },
            total: {
                type: Number, required: false, validate: {
                    validator: function (v) {
                        return v >= 0;
                    },
                    message: props => `${props.value} is not a valid amount! Amount cannot be negative.`
                }
            },
            reserved: {
                type: Number, required: false, validate: {
                    validator: function (v) {
                        return v >= 0;
                    },
                    message: props => `${props.value} is not a valid amount! Amount cannot be negative.`
                }
            }
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        qrCode: {
            title: {
                type: String,
                required: false
            },
            description: {
                type: String,
                required: false
            },
            status: {
                type: String,
                required: false
            },
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
            },
            new: {
                type: Boolean,
                required: false
            }
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('wallet', wallet);