const mongoose = require('mongoose');

const beneficiary = mongoose.Schema(
    {
        first_name: { type: String, required: false },
        last_name: { type: String, required: false },
        company_name: { type: String, required: false },
        email: { type: String, required: false },
        phone: { type: String, required: false },
        address: { type: String, required: false },
        zip_code: { type: String, required: false },
        city: { type: String, required: false },
        deleted: { type: Boolean, required: false },
        country_name: { type: String, required: false },
        country_iso_code: { type: String, required: false },
        relation: { type: String, required: false },
        beneficiary_type: { type: String, required: false },
        account_type: { type: Array, required: false },
        isVerified: { type: Boolean, required: false },
        //BANK
        isUsaBank: { type: Boolean, required: false },
        extras: { type: Object, required: false },
        bank_details: [
            {
                swift_code: { type: String, required: false },
                iban: { type: String, required: false },
                account_number: { type: String, required: false },
                name: { type: String, required: false },
                branch_name: { type: String, required: false },
                branch_street: { type: String, required: false },
                city: { type: String, required: false },
                province: { type: String, required: false },
                postal_code: { type: String, required: false },
                account_holder_name: { type: String, required: false },
                extras: { type: Object, required: false }
            }
        ],
        //MOBILE
        mobile_wallet: [
            {
                money_provider: { type: String, required: false },
                wallet_name: { type: String, required: false },
                wallet_account_number: { type: String, required: false },
                extras: { type: Object, required: false }
            }
        ],
        //CASH PICKUP
        cash_pickup: [
            {
                document_type: { type: String, required: false },
                document_number: { type: String, required: false },
                extras: { type: Object, required: false }
            }
        ],
        //CRYPTO
        crypto: [
            {
                currency: { type: String, required: false },
                wallet_address: { type: String, required: false },
                extras: { type: Object, required: false }
            }
        ],
        //CARD
        card: [{
            name: { type: String, required: false },
            number: { type: String, required: false },
            expiry: { type: String, required: false },
            extras: { type: Object, required: false }
        }],
        wallet: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        }],
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "country",
            required: false,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('beneficiary', beneficiary);