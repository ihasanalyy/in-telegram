const mongoose = require('mongoose');

const markup = mongoose.Schema(
    {
        service_name: { type: String, required: false },

        flat_markup: { type: Number, required: false },
        percentage_markup: { type: Number, required: false },
        markup_type: { type: String, required: false },
        markup_currency: { type: Number, required: false },

        account_type: { type: String, required: false },
        account_level: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account_level",
            required: true,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('markup', markup);