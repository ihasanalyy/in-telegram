const mongoose = require("mongoose")

const userKey = mongoose.Schema({
    webhook_url: { type: String, required: false },
    api_key: { type: String, required: false },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    status: { type: String, required: false },
})

module.exports = mongoose.model('userKey', userKey);