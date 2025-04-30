const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CountrySchmea = Schema({
    country_name: { type: String, required: true },
    country_iso_code: { type: String, required: true },
    status: { type: String, required: false },
    receivingActive: { type: Boolean, required: false },
    individual_registration_active: { type: Boolean, required: false },
    business_registration_active: { type: Boolean, required: false },
    kyc_fee: { type: Number, required: false },
    kyb_fee: { type: Number, required: false },

    // individual_channels: {
    //     international_bank_payments: { type: Boolean, required: false },
    //     international_mobile_wallet_payments: { type: Boolean, required: false },
    //     international_cash_pickup_payments: { type: Boolean, required: false },
    //     wallet_to_wallet_payments: { type: Boolean, required: false },
    //     payment_requests: { type: Boolean, required: false },
    //     crypto_to_fiat: { type: Boolean, required: false },
    //     send_quotation: { type: Boolean, required: false },
    //     international_card_payment: { type: Boolean, required: false },
    //     qr_pay: { type: Boolean, required: false },
    // },

    // business_channels: {
    //     international_bank_payments: { type: Boolean, required: false },
    //     international_mobile_wallet_payments: { type: Boolean, required: false },
    //     international_cash_pickup_payments: { type: Boolean, required: false },
    //     wallet_to_wallet_payments: { type: Boolean, required: false },
    //     payment_requests: { type: Boolean, required: false },
    //     crypto_to_fiat: { type: Boolean, required: false },
    //     send_quotation: { type: Boolean, required: false },
    //     international_card_payment: { type: Boolean, required: false },
    //     qr_pay: { type: Boolean, required: false },
    // },

    delete: { type: Boolean, required: false },
    delete_time: { type: Date, required: false },

    thunes: { type: Boolean, required: false },
    mfs_africa: { type: Boolean, required: false },
    swiss_remit: { type: Boolean, required: false },

    bank_transfer: {
        thunes: { type: Number, required: false },
        mfs_africa: { type: Number, required: false },
        swiss_remit: { type: Number, required: false },
    },

    mobile_wallet: {
        thunes: { type: Number, required: false },
        mfs_africa: { type: Number, required: false },
        swiss_remit: { type: Number, required: false },
    },

    crypto_wallet: {
        thunes: { type: Number, required: false },
        mfs_africa: { type: Number, required: false },
        swiss_remit: { type: Number, required: false },
    },

    card_payment: {
        thunes: { type: Number, required: false },
        mfs_africa: { type: Number, required: false },
        swiss_remit: { type: Number, required: false },
    },

    cash_pickup: {
        thunes: { type: Number, required: false },
        mfs_africa: { type: Number, required: false },
        swiss_remit: { type: Number, required: false },
    },

    // individual_withdrawal_channel: {
    //     bank_account: { type: Boolean, default: true },
    //     mobile_money: { type: Boolean, default: true },
    //     cash_pickup: { type: Boolean, default: true },
    //     card_payment: { type: Boolean, default: true },
    //     crypto_wallet: { type: Boolean, default: true },
    // },

    // business_withdrawal_channel: {
    //     bank_account: { type: Boolean, default: true },
    //     mobile_money: { type: Boolean, default: true },
    //     cash_pickup: { type: Boolean, default: true },
    //     card_payment: { type: Boolean, default: true },
    //     crypto_wallet: { type: Boolean, default: true },
    // },

    // individual_topup_channel: {
    //     bank_account: { type: String, required: false },
    //     mobile_money: { type: String, required: false },
    //     paypal: { type: String, required: false },
    //     card_payment: { type: String, required: false },
    // },

    // business_topup_channel: {
    //     bank_account: { type: String, required: false },
    //     mobile_money: { type: String, required: false },
    //     paypal: { type: String, required: false },
    //     card_payment: { type: String, required: false },
    // },
    individual_guest_payout_channels: {
        bank_account: { type: Boolean, required: false },
        mobile_money: { type: Boolean, required: false },
        paypal: { type: Boolean, required: false },
        card_payment: { type: Boolean, required: false },
    },

    business_guest_payout_channels: {
        bank_account: { type: Boolean, required: false },
        mobile_money: { type: Boolean, required: false },
        paypal: { type: Boolean, required: false },
        card_payment: { type: Boolean, required: false },
    },

    individual_receiving_channels: {
        bank_account: { type: Boolean, required: false },
        mobile_money: { type: Boolean, required: false },
        paypal: { type: Boolean, required: false },
        card_payment: { type: Boolean, required: false },
        cash_pickup: { type: Boolean, required: false },
    },

    business_receiving_channels: {
        bank_account: { type: Boolean, required: false },
        mobile_money: { type: Boolean, required: false },
        paypal: { type: Boolean, required: false },
        card_payment: { type: Boolean, required: false },
        cash_pickup: { type: Boolean, required: false },
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("country", CountrySchmea)

// recieving country
// get all countries (clone)
// get all mein bs iso_code

// benef 