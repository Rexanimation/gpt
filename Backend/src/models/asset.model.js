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
        required: true
    },
    url: {
        type: String,
        required: true
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
    }
}, {
    timestamps: true
});

const assetModel = mongoose.model("asset", assetSchema);

module.exports = assetModel;
