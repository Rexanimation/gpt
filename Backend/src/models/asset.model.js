const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        default: 0
    },
    url: {
        type: String,
        default: ""
    },
    tags: {
        type: [String],
        default: []
    },
    summary: {
        type: String,
        default: ""
    },
    colors: {
        type: [String],
        default: []
    },
    resolution: {
        type: String,
        default: "Unknown"
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    // Google Drive structures
    isFolder: {
        type: Boolean,
        default: false
    },
    parentFolderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'asset',
        default: null
    },
    mimeType: {
        type: String,
        default: ""
    },
    // Access permission mappings
    publicLinkAccess: {
        type: String,
        enum: ['restricted', 'view', 'comment', 'edit'],
        default: 'restricted'
    },
    sharedUsers: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'user'
            },
            email: {
                type: String
            },
            role: {
                type: String,
                enum: ['viewer', 'commenter', 'editor'],
                default: 'viewer'
            }
        }
    ]
}, {
    timestamps: true
});

const assetModel = mongoose.model("asset", assetSchema);

module.exports = assetModel;
