const mongoose = require('mongoose');

const category = mongoose.Schema(
    {
        business_type: { type: String, required: false },
        account_type: { type: String, required: false },
        name: { type: String, required: false },
        // international_bank_payments: { type: Boolean, required: false },
        // international_mobile_wallet_payments: { type: Boolean, required: false },
        // international_cash_pickup_payments: { type: Boolean, required: false },
        // wallet_to_wallet_payments: { type: Boolean, required: false },
        // payment_requests: { type: Boolean, required: false },
        // crypto_to_fiat: { type: Boolean, required: false },
        // send_quotation: { type: Boolean, required: false },
        // international_card_payment: { type: Boolean, required: false },
        // qr_pay: { type: Boolean, required: false },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('category', category);