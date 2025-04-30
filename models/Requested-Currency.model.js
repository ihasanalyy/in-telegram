const mongoose = require("mongoose")

const requested_currency = mongoose.Schema(
    {
        code: { type: String, required: false },
        status: { type: String, required: false },
        description: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "available_currency",
            required: true,
        },
        createdAt: { type: Date, default: Date.now },

    }
)

module.exports = mongoose.model('requested_currency', requested_currency);