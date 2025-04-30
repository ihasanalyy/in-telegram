const mongoose = require('mongoose');

const transaction_category = mongoose.Schema(
    {
        name: { type: String, required: false },
        type: { type: String, required: false },
        description: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('transaction_category', transaction_category);