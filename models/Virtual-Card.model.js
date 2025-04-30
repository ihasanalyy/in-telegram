const mongoose = require("mongoose")

const virtualCard = mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: true,
    },
    last4: { type: String, required: true },
    expiry: { type: String, required: true },
    card_id: { type: String, required: true },
    type: { type: String, required: true },// "virtual" or "physical"
    subscription_type: { type: String, required: false },// "standard", "premium", "premium_plus"
    premium_features: {
        apple_pay: { type: Boolean, default: false },
        google_pay: { type: Boolean, default: false }
    },
    currency: { type: String, required: true },
}, { timestamps: true })

module.exports = mongoose.model("virtualCard", virtualCard)