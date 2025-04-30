const mongoose = require('mongoose');

const authSecret = mongoose.Schema(
    {
        value: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('authSecret', authSecret);