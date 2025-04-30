const mongoose = require('mongoose');

const account = mongoose.Schema(
    {
        first_name: { type: String, required: false },
        last_name: { type: String, required: false },
        company_name: { type: String, required: false },
        email: { type: String, required: false },
        username: { type: String, required: false, unique: true },

        password: { type: String, required: false },
        isTempPassword: { type: Boolean, required: false },
        isPassword: { type: Boolean, required: false },
        passwordToken: { type: String, required: false },
        pin: { type: String, required: false }, // pin for all the chatbots
        pin_status: { type: Boolean, required: false },
        pin_attempts: { type: Number, required: false },

        challenge: { type: String, required: false }, // for authentication
        // passkey: {
        //     credentialID: { type: Buffer, required: false },
        //     credentialPublicKey: { type: Buffer, required: false },
        //     counter: { type: Number, required: false },
        // },
        passkeys: [{
            credentialID: { type: Buffer, required: true },
            credentialPublicKey: { type: Buffer, required: true },
            counter: { type: Number, required: true },
            deviceName: { type: String, required: true },
            enabled: { type: Boolean, default: true }
        }],

        source: { type: String, required: false },
        phone: { type: String, required: false },
        address: { type: String, required: false },
        city: { type: String, required: false },
        postal_code: { type: String, required: false },
        about_me: { type: String, required: false },
        gender: { type: String, required: false },
        dob: { type: String, required: false },
        language: { type: String, required: false },
        account_type: { type: String, required: false },
        level: { type: Number, required: false },
        profileCompleted: { type: Boolean, required: false, default: false },
        active: { type: Boolean, required: false },
        status: { type: String, required: false },
        deleted: { type: Boolean, required: false },

        account_locked: { type: Boolean, required: false },
        account_locked_count: { type: Number, required: false },
        lock_until: { type: Date, required: false },

        commission: { type: Number, required: false },
        external_witdrawal_commission: { type: Number, required: false },

        kyc_verification_paid: { type: Boolean, required: false },

        isPhoneSearch: { type: Boolean, required: false },
        isEmailSearch: { type: Boolean, required: false },

        tfa: { type: Boolean, required: false },
        sms_verification: { type: Boolean, required: false },
        email_verification: { type: Boolean, required: false },


        telegramBotToken: { type: String, required: false },
        telegram_bot: { type: Boolean, required: false },
        telegram_id: { type: String, required: false },
        telegram_username: { type: String, required: false },

        instaBotToken: { type: String, required: false },
        insta_username: { type: String, required: false },
        insta_subscriber_id: { type: String, required: false },
        insta_bot: { type: Boolean, required: false },
        insta_recipient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "instaChatBot",
            required: false,
        },

        whatsAppBotToken: { type: String, required: false },
        timezone: { type: String, required: false },
        country_name: { type: String, required: false },
        country_iso_code: { type: String, required: false },
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "country",
            required: false,
        },
        user_nationaility: { type: String, required: false },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "category",
            required: false,
        },

        is_external_limit: { type: Boolean, required: false },

        external_limits: {
            account_balance_limit: { type: Number, required: false },
            wallet_limit_conversion: { type: Number, required: false },
            transaction_amount_limit: { type: Number, required: false },
            topup_min_amount: { type: Number, required: false },
            topup_max_amount: { type: Number, required: false },

            daily_sending_limit: { type: Number, required: false },
            monthly_sending_limit: { type: Number, required: false },
            yearly_sending_limit: { type: Number, required: false },

            daily_receiving_limit: { type: Number, required: false },
            monthly_receiving_limit: { type: Number, required: false },
            yearly_receiving_limit: { type: Number, required: false },

            daily_transaction_count: { type: Number, required: false },
            monthly_transaction_count: { type: Number, required: false },
            yearly_transaction_count: { type: Number, required: false },

        },

        used_limits: {

            daily_sending_limit: { type: Number, required: false },
            monthly_sending_limit: { type: Number, required: false },
            yearly_sending_limit: { type: Number, required: false },

            daily_receiving_limit: { type: Number, required: false },
            monthly_receiving_limit: { type: Number, required: false },
            yearly_receiving_limit: { type: Number, required: false },

            daily_transaction_count: { type: Number, required: false },
            monthly_transaction_count: { type: Number, required: false },
            yearly_transaction_count: { type: Number, required: false },

        },


        // sending_limit: { type: Number, required: false },
        // receiving_limit: { type: Number, required: false },
        // sending_limit_used: { type: Number, required: false },
        // receiving_limit_used: { type: Number, required: false },

        level: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account_level",
            required: false,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: false,
        },
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "company",
            required: false,
        },
        profileImage: {
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
        coverImage: {
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
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account',
            required: false
        },
        deletedAt: { type: Date, default: null },
        lastCheckDate: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('account', account);