const mongoose = require('mongoose');

const paymentUrl = mongoose.Schema({
    url: { type: String, required: false },
    short_code: { type: String, required: false },
    ETag: { type: String, required: false },
    qr_url: { type: String, required: false },
    key: { type: String, required: false },
    product_name: { type: String, required: false },
    amount: { type: Number, required: false },
    description: { type: String, required: false },
    address: { type: String, required: false },
    currency: { type: String, required: false },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    api_key: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "userKey",
        required: false,
    },
    created_at: { type: String, required: false },
})

module.exports = mongoose.model('payment_url', paymentUrl);