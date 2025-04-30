const mongoose = require("mongoose")

const payment_address = mongoose.Schema({
    title: { type: String, required: false },
    description: { type: String, required: false },
    currency: { type: String, required: false },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: true
    },
    status: { type: Boolean, required: false, default: false },
    active: { type: Boolean, required: false, default: false },
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
    }

})

module.exports = mongoose.model('payment_address', payment_address)