const mongoose = require('mongoose');

const withdrawalCommission = mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account',
            required: true
        },
        payer_id: {
            type: String,
            required: true
        },
        service_id: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('withdrawal-commission', withdrawalCommission)