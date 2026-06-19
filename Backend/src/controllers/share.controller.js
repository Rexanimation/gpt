const assetModel = require('../models/asset.model');
const userModel = require('../models/user.model');

async function shareAsset(req, res) {
    try {
        const owner = req.user;
        const { id } = req.params;
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ message: "Email and role are required" });
        }

        // Find the asset and verify ownership
        const asset = await assetModel.findOne({ _id: id, user: owner._id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found or you are not the owner" });
        }

        // Find the collaborator user by email
        const collaborator = await userModel.findOne({ email: email.trim().toLowerCase() });
        if (!collaborator) {
            return res.status(404).json({ message: "User with this email address was not found" });
        }

        // Check if already shared
        const existingPermissionIndex = asset.sharedUsers.findIndex(u => u.userId.toString() === collaborator._id.toString());
        if (existingPermissionIndex !== -1) {
            asset.sharedUsers[existingPermissionIndex].role = role;
        } else {
            asset.sharedUsers.push({
                userId: collaborator._id,
                email: collaborator.email,
                role: role
            });
        }

        await asset.save();

        res.status(200).json({
            message: `Asset shared successfully with ${email} as ${role}`,
            asset
        });
    } catch (err) {
        console.error("Share Asset error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function updateLinkAccess(req, res) {
    try {
        const owner = req.user;
        const { id } = req.params;
        const { publicLinkAccess } = req.body;

        if (!publicLinkAccess) {
            return res.status(400).json({ message: "publicLinkAccess is required" });
        }

        const asset = await assetModel.findOne({ _id: id, user: owner._id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found or you are not the owner" });
        }

        asset.publicLinkAccess = publicLinkAccess;
        await asset.save();

        res.status(200).json({
            message: `Link sharing access set to ${publicLinkAccess}`,
            asset
        });
    } catch (err) {
        console.error("Update Link Access error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function getSharedWithMe(req, res) {
    try {
        const user = req.user;

        // Find files shared with the user
        const assets = await assetModel.find({
            "sharedUsers.userId": user._id
        }).sort({ createdAt: -1 });

        res.status(200).json({
            message: "Shared assets retrieved successfully",
            assets
        });
    } catch (err) {
        console.error("Get Shared With Me error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    shareAsset,
    updateLinkAccess,
    getSharedWithMe
};
