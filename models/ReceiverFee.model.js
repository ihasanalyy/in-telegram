const mongoose = require('mongoose');

const receiverFee = mongoose.Schema(
    {
        service_name: { type: String, required: false },

        flat_fee: { type: Number, required: false },
        percentage_fee: { type: Number, required: false },
        fee_type: { type: String, required: false },
        fee_currency: { type: String, required: false },

        flat_markup: { type: Number, required: false },
        percentage_markup: { type: Number, required: false },
        markup_type: { type: String, required: false },
        markup_currency: { type: String, required: false },

        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "country",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('receiverFee', receiverFee);