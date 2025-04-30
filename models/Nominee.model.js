const mongoose = require('mongoose');

const nominee = mongoose.Schema(
    {
        full_name: { type: String, required: false },
        dob: { type: Date, required: false },
        gender: { type: String, required: false },
        address: { type: String, required: false },
        relationship: { type: String, required: false },
        contact: { type: String, required: false },
        picture: {
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
            }
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('nominee', nominee);