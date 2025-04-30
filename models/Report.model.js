const mongoose = require('mongoose');

const report = mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        status: { type: String, required: false },
        desc: { type: String, required: false },
        reason: { type: String, required: false },
        createdAt: { type: Date, default: Date.now },
        referral: { type: String, required: false }
    }
);

module.exports = mongoose.model('report', report);