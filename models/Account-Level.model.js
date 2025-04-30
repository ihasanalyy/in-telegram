const mongoose = require('mongoose');
const UserWithdrawalModel = require('./User-Withdrawal.model');

const account_level = mongoose.Schema(
    {
        level_no: { type: Number, required: false },
        account_balance_limit: { type: Number, required: false },

        wallet_limit_conversion: { type: Number, required: false },

        daily_sending_limit: { type: Number, required: false },
        monthly_sending_limit: { type: Number, required: false },
        yearly_sending_limit: { type: Number, required: false },

        daily_receiving_limit: { type: Number, required: false },
        monthly_receiving_limit: { type: Number, required: false },
        yearly_receiving_limit: { type: Number, required: false },

        daily_transaction_count: { type: Number, required: false },
        monthly_transaction_count: { type: Number, required: false },
        yearly_transaction_count: { type: Number, required: false },

        transaction_amount_limit: { type: Number, required: false },
        topup_min_amount: { type: Number, required: false },
        topup_max_amount: { type: Number, required: false },

        international_transfer: {
            bank: { type: Boolean, required: false },
            mobile_money: { type: Boolean, required: false },
            cash_pickup: { type: Boolean, required: false },
            card_payment: { type: Boolean, required: false },
        },

        withdrawal_channel: {
            bank: { type: Boolean, required: false },
            mobile_money: { type: Boolean, required: false },
            cash_pickup: { type: Boolean, required: false },
            card_payment: { type: Boolean, required: false },
        },

        topup_channel: {
            bank: { type: Boolean, required: false },
            mobile_money: { type: Boolean, required: false },
            paypal: { type: Boolean, required: false },
            card_payment: { type: Boolean, required: false },
        },

        wallet_to_wallet: {
            send: { type: Boolean, required: false },
            receive: { type: Boolean, required: false },
            conversion: { type: Boolean, required: false },

            send_crypto: { type: Boolean, required: false },
            receive_crypto: { type: Boolean, required: false },
            crypto_to_fiat: { type: Boolean, required: false },
        },

        payment_request: {
            send: { type: Boolean, required: false },
            receive: { type: Boolean, required: false },
        },

        payment_address: {
            send: { type: Boolean, required: false },  // Pay to someone payment address
            receive: { type: Boolean, required: false }, // My own payment address
        },

        qr_pay: {
            send: { type: Boolean, required: false }, // Pay to someone QR Code
            receive: { type: Boolean, required: false },  // My own QR Code
        },

        quotation: {
            send: { type: Boolean, required: false }, // Pay to someone QR Code
            receive: { type: Boolean, required: false },  // My own QR Code
        },

        send_crypto_to_other_wallet: { type: Boolean, required: false },
        airtime: { type: Boolean, required: false },
        bundle: { type: Boolean, required: false },
        data: { type: Boolean, required: false },
        internet: { type: Boolean, required: false },
        television: { type: Boolean, required: false },
        voip: { type: Boolean, required: false },
        retail: { type: Boolean, required: false },
        cash_card: { type: Boolean, required: false },
        entertainment: { type: Boolean, required: false },
        travel_and_transport: { type: Boolean, required: false },

        account_type: { type: String, required: false },
        country_name: { type: String, required: false },
        country_iso_code: { type: String, required: false },
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "country",
            required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "category",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('account_level', account_level);