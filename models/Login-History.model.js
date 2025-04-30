const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loginHistorySchema = Schema({
    browser_name: {
        type: String,
        required: false
    },
    browser_version: {
        type: String,
        required: false
    },
    is_mobile_user: {
        type: Boolean,
        required: false
    },
    location: {
        IPv4: {
            type: String,
            required: false
        },
        city: {
            type: String,
            required: false
        },
        country_code: {
            type: String,
            required: false
        },
        country_name: {
            type: String,
            required: false
        },
        latitude: {
            type: String,
            required: false
        },
        longitude: {
            type: String,
            required: false
        },
        postal: {
            type: String,
            required: false
        },
        state: {
            type: String,
            required: false
        }
    },
    platform: {
        type: String,
        required: false
    },
    account: {
        type: Schema.Types.ObjectId,
        ref: "account",
        required: true,
    },
    createdAt: { type: Date, default: Date.now }

});

const loginHistory = mongoose.model("login_history", loginHistorySchema);
module.exports = loginHistory;