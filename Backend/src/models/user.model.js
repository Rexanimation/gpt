const mongoose = require('mongoose');



const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    fullName: {
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        }
    },
    password: {
        type: String,
    },
    usedStorage: {
        type: Number,
        default: 0
    },
    storageQuota: {
        type: Number,
        default: 20 * 1024 * 1024 * 1024 // 20 GB
    }
},
    {
        timestamps: true
    }
)

const userModel = mongoose.model("user", userSchema)


module.exports = userModel