const mongoose = require('mongoose');

const document = mongoose.Schema(
    {
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        description: {
            type: String,
            required: false
        },
        file_type: {
            type: String,
            required: false
        },
        title: {
            type: String,
            required: false
        },
        document_details: {
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
        jw_media: {
            mediaId: {
                type: String,
                required: false
            },
            status: {
                type: String,
                required: false
            },
            thumbnail_url: {
                type: String,
                required: false
            }
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('document', document);