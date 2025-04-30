const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
    thune_fee: {
        fixed: { type: Number, default: null },
        percent: { type: Number, default: null },
    },
    InstaPay_Markup: {
        markup_percentage: { type: String, default: null },
        markup_fixed: { type: String, default: null },
    },
});

const paymentMethodSchema = new mongoose.Schema({
    name: { type: String, required: false },
    vendor: { type: String, required: false },
    payment_page_id: { type: String, default: null },
    active: { type: Boolean, default: false },
    step: { type: Number, default: null },
    fee: feeSchema,
});

const thunes_collection = new mongoose.Schema({
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "country",
        required: false,
    },
    country_code: { type: String, required: true }, // e.g., "PAK", "POL", "PRT", "IND"
    merchant_id: { type: String, default: null },
    currency: { type: String, required: false }, // e.g., "PKR", "PLN", "EUR", "INR"
    wallet: [paymentMethodSchema], // array of wallet payment methods
    bank: [paymentMethodSchema], // array of bank payment methods
    crypto: [paymentMethodSchema], // array of crypto payment methods
    card: [paymentMethodSchema], // array of card payment methods
});

module.exports = mongoose.model('thunes_collection', thunes_collection);
