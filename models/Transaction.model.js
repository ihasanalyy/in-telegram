const mongoose = require('mongoose');

const transaction = mongoose.Schema(
    {
        reference_id: { type: String, required: false },
        schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: "schedule", required: false },
        subscription_id: { type: mongoose.Schema.Types.ObjectId, ref: "schedule", required: false },
        type: { type: String, required: false },
        transaction_type: { type: String, required: false },
        service_type: { type: String, required: false },
        payment_type: { type: String, required: false },
        status: { type: String, required: false },
        description: { type: String, required: false },
        purpose: { type: String, required: false },
        reason: { type: String, required: false },
        is_card_save: { type: Boolean, required: false },
        payment_id: { type: String, required: false },//Paypal
        external_reference: { type: String, required: false },
        external_status: { type: String, required: false },
        hidden: { type: Boolean, required: false },
        currency: {
            code: { type: String, required: false },
            symbol: { type: String, required: false }
        },
        // amount: { type: Number, required: false },
        amount: {
            type: Number,
            required: false,
            validate: {
                validator: function (v) {
                    return v >= 0;
                },
                message: props => `${props.value} is not a valid amount! Amount cannot be negative.`
            }
        },
        recipient_received_amount: { type: Number, required: false },
        recipient_received_currency: { type: String, required: false },
        fee: { type: Number, required: false },
        ip_fee: { type: Number, required: false },
        fee_type: { type: String, required: false },

        vespia: {
            folder_id: { type: String, required: false },
            aml_link: { type: String, required: false },
            rule_id: [{ type: Number, required: false }],
            status: { type: String, enum: ["CHECKED", "CLEAR", "RISKY"], required: false },
            alerts: [{ type: String, required: false }]
        },

        markup: { type: Number, required: false },
        markup_currency: { type: String, required: false },
        exchange_rate_markup: { type: Number, required: false },
        exchange_rate: { type: Number, required: false },
        feeToSendingRate: { type: Number, required: false },

        replacement_currency: {
            code: { type: String, required: false },
            value: { type: Number, required: false },
            rate: { type: Number, required: false },
        },

        vendor: {
            name: { type: String, required: false },
            fee: { type: Number, required: false },
            rate: { type: Number, required: false },
        },

        guest_details: {
            name: { type: String, required: false },
            phone: { type: String, required: false },
            email: { type: String, required: false },
        },

        channel_details: { type: Object, required: false },
        airtime_number: { type: String, required: false },

        total: { type: Number, required: false },
        current_balance: { type: Number, required: false },
        new_balance: { type: Number, required: false },
        wallet_id: { type: String, required: false },
        attachments: [
            {
                key: {
                    type: String,
                    required: false
                },
                url: {
                    type: String,
                    required: false
                },
                ETag: {
                    type: String,
                    required: false
                }
            },
        ],
        timeline: [
            {
                date: { type: Date, required: false },
                status: { type: String, required: false },
            }
        ],
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        beneficiary: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "beneficiary",
            required: false,
        },
        categories:
            [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "transaction_category",
                required: false,
            }]
        ,
        note: { type: String, required: false },
        external_token: {
            token: { type: String, required: false },
            type: { type: String, required: false },
        },
        lat: { type: String, required: false },
        long: { type: String, required: false },
        display_name: { type: String, required: false },
        address: { type: Object, required: false },
        notificationNotSent: { type: Boolean, required: false },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('transaction', transaction);