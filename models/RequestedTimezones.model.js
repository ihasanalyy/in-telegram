const mongoose = require('mongoose');

const requested_timezone = mongoose.Schema(
    {
        timezone: { type: String, required: false },
        status: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('requested_timezone', requested_timezone);