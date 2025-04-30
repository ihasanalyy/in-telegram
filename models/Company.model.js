const mongoose = require("mongoose");

const company = mongoose.Schema({
    company_name: { type: String, required: false },
    kyc_status: { type: String, required: false },
    // parentId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'company',
    //     required: false
    // },
    //   business_verification_type: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "category",
    //     required: false,
    //   },
    business_verification_type: { type: String, required: false },
    kyb_status: { type: String, required: false },
    kyb_files: [
        {
            document_type: { type: String, required: false },
            file_type: { type: String, required: false },
            file_link: { type: String, required: false },
            status: { type: String, required: false },
            key: { type: String, required: false },
            document_name: { type: String, required: false },
        },
    ],
    kyb_additional_file: [
        {
            document_type: { type: String, required: false },
            desc: { type: String, required: false },
            file_type: { type: String, required: false },
            file_link: { type: String, required: false },
            status: { type: String, required: false },
            key: { type: String, required: false },
        },
    ],
    question1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "securityQuestion",
        required: false,
    },
    answer1: { type: String, required: false },
    question2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "securityQuestion",
        required: false,
    },
    answer2: { type: String, required: false },
    question3: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "securityQuestion",
        required: false,
    },
    answer3: { type: String, required: false },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: true,
    },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("company", company);
