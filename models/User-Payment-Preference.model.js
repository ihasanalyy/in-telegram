const mongoose = require("mongoose")

const userPaymentPreference = new mongoose.Schema({
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'account' },
    checks: [
        {
            isoCode: { type: String },
            reason: {
                type: [String],
                enum: ['payment_request_live', 'payment_request_origin']
            }
        }
    ]
})

module.exports = mongoose.model('userPaymentPreference', userPaymentPreference)