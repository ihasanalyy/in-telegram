const mongoose = require('mongoose');

const commission = mongoose.Schema(
    {
        parent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account',
            required: false
        },
        child: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account',
            required: false
        },
        commission: {
            type: Number,
            required: false
        },
        currency: {
            type: String,
            required: false
        },
        account_type: {
            type: String,
            required: false
        },
        iso3: {
            type: String,
            required: false
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('commission', commission)