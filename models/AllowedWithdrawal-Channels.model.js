const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const allowedWithdrawalChannelSchema = Schema({
    country_name: { type: String, required: false },
    country_iso_code: { type: String, required: false },
    user_type: {
        inindividual: {
            bank_account: {
                type: Boolean,
                default: true
            },
            mobile_money: {
                type: Boolean,
                default: true
            },
            cash_pickup: {
                type: Boolean,
                default: true
            },
            card_payment: {
                type: Boolean,
                default: true
            },
            crypto_wallet: {
                type: Boolean,
                default: true
            },
        },
        business: {
            bank_account: {
                type: Boolean,
                default: true
            },
            mobile_money: {
                type: Boolean,
                default: true
            },
            cash_pickup: {
                type: Boolean,
                default: true
            },
            card_payment: {
                type: Boolean,
                default: true
            },
            crypto_wallet: {
                type: Boolean,
                default: true
            },
        },
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('allowed_withdrawal_channels', allowedWithdrawalChannelSchema);