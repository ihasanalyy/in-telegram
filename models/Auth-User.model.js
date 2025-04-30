const mongoose = require('mongoose');

const auth_user = mongoose.Schema(
    {
        token: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('auth_user', auth_user);