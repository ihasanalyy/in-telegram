const mongoose = require('mongoose');

const notifications_status = mongoose.Schema(
    {
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        payments: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        bulk_payments: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        payment_requests: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        add_funds: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        quotation: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        referrals: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        login: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
        password: {
            email: { type: Boolean, required: false },
            phone: { type: Boolean, required: false },
            instagram: { type: Boolean, required: false },
        },
    }
);

module.exports = mongoose.model('notifications_status', notifications_status);