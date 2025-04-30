const mongoose = require("mongoose")

const esim = mongoose.Schema({
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    productDesc: { type: String, required: true },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: true,
    }
})

module.exports = mongoose.model("esim", esim)