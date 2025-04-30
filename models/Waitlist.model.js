const mongoose = require('mongoose');

const wait_list = mongoose.Schema(
    {
        first_name: { type: String, required: false },
        last_name: { type: String, required: false },
        email: { type: String, required: false },
        phone: { type: String, required: false },
        tag: { type: String, required: false },
        country_name: { type: String, required: false },
        country_iso_code: { type: String, required: false },
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "country",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('wait_list', wait_list);