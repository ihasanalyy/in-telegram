const mongoose = require("mongoose")

const telegramBot = mongoose.Schema({
    recipient: { type: String, required: false },
    last_message: { type: String, required: false },
    last_message_time: { type: Date, required: false },
    account_connected: { type: Boolean, required: false },
    selected_language: { type: String, required: false },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'account', required: false },

    loggedOut: { type: Boolean, required: false, default: false },

    otpToken: { type: String, required: false },
    otpType: { type: String, required: false },
    otpAttemptCount: { type: Number, default: 0 },

    registeration: {
        first_name: { type: String, required: false },
        last_name: { type: String, required: false },
        phone_number: { type: String, required: false },
        iso_code: { type: String, required: false },
        temp_password: { type: String, required: false },
        temp_password_count: { type: Number, required: false },
        verificationTokenHash: { type: String, required: false },
        verificationTokenExpiration: { type: Date, required: false },
        verificationAttempts: { type: Number, required: false },
        username: { type: String, required: false },
        timezone: { type: String, required: false },
        timezones: { type: Array, required: false },
        timezonePageIndex: { type: Number, required: false },
        city: { type: String, required: false },
        source: { type: String, required: false },
        dob: { type: String, required: false },
    },

    international_transfer: {
        intl_country_code: { type: String, required: false },
        intl_country: { type: String, required: false },
        intl_payout_method: { type: String, required: false },
        search_results: { type: Array, required: false },
        intl_payer_id: { type: String, required: false },
        intl_payout_channel: { type: String, required: false },
        intl_note: { type: String, required: false },
        intl_beneficiaries: [{ type: Object, required: false }],
        purpose: { type: String, required: false },
        intl_benef_id: { type: String, required: false },
        intl_amount: { type: Number, required: false },
        intl_exchngrate_token: { type: String, required: false },
        intl_sending_currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        intl_quotation_id: { type: String, required: false },
        intl_attachments: [
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
            }
        ],
        card: {
            pan: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "pan",
                required: false,
            },
            amount: { type: Number, required: false },
            intl_exchngrate_token: { type: String, required: false },
            intl_quotation_id: { type: String, required: false },
        },
    },

    wallet_to_wallet: {
        requested_currency: {
            type: String,
            required: false
        },
        receiving_wallet: {
            type: String,
            required: false,
        },
        sending_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false
        },
        converting_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false
        },
        amount: { type: Number, required: false },
        purpose: { type: String, required: false },
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
            }
        ],
        note: { type: String, required: false },
        card: {
            pan: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "pan",
                required: false,
            },
        }
    },

    schedule: {
        scheduleTime: { type: String, required: false },
        scheduleDate: { type: String, required: false },
        scheduleTimezone: { type: String, required: false },

        subscriptionDate: { type: String, required: false },
        subscriptionCycles: { type: Number, required: false },
        subscriptionEndDate: { type: String, required: false },
        subscriptionUntilIStop: { type: Boolean, required: false },
        subscriptionTimezone: { type: String, required: false },
    },

    request: {
        request_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "request_payment",
            required: false
        },
        beneficiary: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        requesting_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        sending_wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false
        },
        amount: {
            type: Number,
            required: false
        },
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
            }
        ],
        note: { type: String, required: false },
        lat: { type: String, required: false },
        long: { type: String, required: false },
        review: { type: String, required: false },
        rating: { type: Number, required: false },
        comment_to_reply: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "request_review",
            required: false,
        },
    },

    vcc: {
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false
        },
        pan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "pan",
            required: false
        },
        token: { type: String, required: false },
        card: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "virtualCard",
            required: false
        },
        isPremiumPlus: {
            type: Boolean,
            required: false
        },
        receiver_card: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "virtualCard",
            required: false
        },
        amount: { type: Number, required: false },
        topup_transaction_token: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false
        },
        note: { type: String, required: false },
    },

    airtime: {
        country: { type: String, required: false },
        country_code: { type: String, required: false },
        phone_number: { type: String, required: false },
        operator: { type: String, required: false },
        operator_id: { type: String, required: false },
        sub_service: { type: String, required: false },
        currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        pan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "pan",
            required: false,
        },
        products: [{ type: Object, required: false }],
        product_id: { type: String, required: false },
        airtime: { type: Object, required: false },
        airtime_amount: { type: Number, required: false },
        airtime_token: { type: String, required: false },
        bundle_token: { type: String, required: false },
        create_airtime_token: { type: String, required: false },
    },

    topup: {
        pan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "pan",
            required: false
        },
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false
        },
        amount: { type: Number, required: false }
    },

    withdrawal: {
        currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        transaction_id: { type: String, required: false },
        channel: { type: Object, required: false },
        fx_token: { type: String, required: false },
        quotation_id: { type: String, required: false },
        amount: { type: Number, required: false },
        default_withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: "withdrawal", required: false },
        withdrawal_flow: { type: String, required: false },
        country: { type: mongoose.Schema.Types.ObjectId, ref: "country", required: false },
    },

    quotation: {
        beneficiary: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        title: { type: String, required: false },
        desc: { type: String, required: false },
        amount: { type: Number, required: false },
        currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        bargain: { type: Boolean, required: false },
        images: [{ type: Object, required: false }],
        accepting_quotation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "quotation",
            required: false,
        },
        accepting_currency: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "wallet",
            required: false,
        },
        bargain_amount: { type: Number, required: false },
        revised_amount: { type: Number, required: false },
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
            }
        ],
    },

    chatbotBannedUntil: { type: Date, required: false },
    chatbotFailedAttempts: { type: Number, required: false },
    chatbotFirstFailedAttempt: { type: Date, required: false },

    lastResendCodeTime: { type: Date, required: false },
})

module.exports = mongoose.model('telegramBot', telegramBot);