const assetModel = require('../models/asset.model');
const aiService = require('../services/ai.service');
const megaService = require('../services/mega.service');
const userModel = require('../models/user.model');
const fs = require('fs');
const path = require('path');

const SEED_ASSETS = [
    {
        name: "sunset_beach.jpg",
        type: "image/jpeg",
        size: 4404019,
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        tags: ["Nature", "Sunset", "Beach", "Ocean", "GoldenHour"],
        summary: "This image features a high-dynamic-range sunset over a tropical coastline. Sahil AI detects 98.4% landscape fidelity. The primary color palette consists of deep oranges (#FF8C00) and violets (#8A2BE2). Perfect for travel promotion or background assets. No copyrighted humans detected.",
        colors: ["#FF8C00", "#8A2BE2"],
        resolution: "4096 x 2304 (4K)"
    },
    {
        name: "product_demo.mp4",
        type: "video/mp4",
        size: 16357785,
        url: "https://assets.mixkit.co/videos/preview/mixkit-keyboard-typing-close-up-846-large.mp4",
        tags: ["Demo", "Clip", "Video"],
        summary: "This video displays a product demonstration. Sahil AI detects high-fidelity user interaction flows, clean desktop workspace environments, and detailed screen recordings.",
        colors: ["#1E293B", "#0F172A"],
        resolution: "1920 x 1080 (1080p)"
    },
    {
        name: "city_skyline.jpg",
        type: "image/jpeg",
        size: 3670016,
        url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800",
        tags: ["Urban", "Travel", "City", "Skyline"],
        summary: "This image captures a wide-angle metropolitan skyline during twilight. Sahil AI detects complex architectural grids, high density structures, and rich ambient street lighting.",
        colors: ["#3B82F6", "#1E3A8A"],
        resolution: "3840 x 2560 (UHD)"
    },
    {
        name: "gear_setup_01.jpg",
        type: "image/jpeg",
        size: 2936012,
        url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800",
        tags: ["Gear", "Setup", "Camera", "Creative"],
        summary: "This image showcases a professional camera gear layout on a dark wooden surface. Sahil AI identifies camera bodies, prime lenses, and key studio accessories.",
        colors: ["#27272A", "#18181B"],
        resolution: "3000 x 2000"
    }
];

async function uploadAsset(req, res) {
    try {
        const user = req.user;
        
        if (!req.file) {
            return res.status(400).json({ message: "No file was uploaded" });
        }

        const name = req.file.originalname;
        const type = req.file.mimetype;
        const size = req.file.size;
        
        // Quota check
        const userRecord = await userModel.findById(user._id);
        if (!userRecord) {
            return res.status(404).json({ message: "User not found" });
        }
        if (userRecord.usedStorage + size > userRecord.storageQuota) {
            if (req.file.path) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(403).json({ message: "Quota exceeded: You do not have enough storage space left." });
        }

        // Upload to MEGA
        let megaHandle = "";
        let url = "";
        try {
            const buffer = fs.readFileSync(req.file.path);
            megaHandle = await megaService.uploadFile(name, size, buffer);
            fs.unlink(req.file.path, () => {});
        } catch (megaErr) {
            console.warn("[MEGA] Upload failed, falling back to local storage:", megaErr.message);
            url = `/uploads/${req.file.filename}`;
        }

        const parentFolderId = req.body.parentFolderId;

        // Call Gemini to generate tags, summary, dominant colors, and resolution
        const analysis = await aiService.analyzeAsset(name, type, size);

        const asset = await assetModel.create({
            user: user._id,
            userId: user._id,
            name,
            type,
            size,
            url,
            megaHandle,
            tags: analysis.tags || [],
            summary: analysis.summary || "",
            colors: analysis.colors || [],
            resolution: analysis.resolution || "Unknown",
            parentFolderId: (parentFolderId && parentFolderId !== 'null' && parentFolderId !== 'undefined') ? parentFolderId : null,
            mimeType: type
        });

        if (megaHandle) {
            asset.url = `/api/assets/stream/${asset._id}`;
            await asset.save();
        }

        // Update storage quota
        userRecord.usedStorage += size;
        await userRecord.save();

        res.status(201).json({
            message: "Asset uploaded and analyzed successfully",
            asset
        });
    } catch (err) {
        console.error("Upload Asset error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function getAssets(req, res) {
    try {
        const user = req.user;
        const { type, favorite, search, parentFolderId } = req.query;

        let query = { userId: req.user.id };

        if (type === 'image') {
            query.type = { $regex: '^image/', $options: 'i' };
            query.isFolder = false;
        } else if (type === 'video') {
            query.type = { $regex: '^video/', $options: 'i' };
            query.isFolder = false;
        } else if (favorite === 'true') {
            query.isFavorite = true;
        } else if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        } else {
            // Folder level filtering
            if (parentFolderId && parentFolderId !== 'null' && parentFolderId !== 'undefined') {
                query.parentFolderId = parentFolderId;
            } else {
                query.parentFolderId = null;
            }
        }

        let assets = await assetModel.find(query).sort({ createdAt: -1 });

        // Auto-seed if no assets exist for this user in general (root folder)
        if (assets.length === 0 && !type && !favorite && !search && (!parentFolderId || parentFolderId === 'null' || parentFolderId === 'undefined')) {
            const userAssetsCount = await assetModel.countDocuments({ userId: req.user.id });
            if (userAssetsCount === 0) {
                const seeded = SEED_ASSETS.map(asset => ({
                    ...asset,
                    user: user._id,
                    userId: req.user.id,
                    parentFolderId: null,
                    mimeType: asset.type
                }));
                await assetModel.insertMany(seeded);
                
                // Add sizes of seeded assets to user's usedStorage
                const totalSeededSize = SEED_ASSETS.reduce((sum, a) => sum + (a.size || 0), 0);
                const userRecord = await userModel.findById(user._id);
                if (userRecord) {
                    userRecord.usedStorage += totalSeededSize;
                    await userRecord.save();
                }

                assets = await assetModel.find(query).sort({ createdAt: -1 });
            }
        }

        res.status(200).json({
            message: "Assets retrieved successfully",
            assets
        });
    } catch (err) {
        console.error("Get Assets error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function toggleFavorite(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        const asset = await assetModel.findOne({ _id: id, userId: req.user.id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found" });
        }

        asset.isFavorite = !asset.isFavorite;
        await asset.save();

        res.status(200).json({
            message: `Asset ${asset.isFavorite ? 'favorited' : 'unfavorited'} successfully`,
            asset
        });
    } catch (err) {
        console.error("Toggle Favorite error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteAsset(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        const asset = await assetModel.findOne({ _id: id, userId: req.user.id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found" });
        }

        // Delete from MEGA if stored on MEGA
        if (asset.megaHandle) {
            try {
                await megaService.deleteFile(asset.megaHandle);
            } catch (megaErr) {
                console.error("[MEGA] Failed to delete file:", megaErr.message);
            }
        } else if (asset.url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../../public', asset.url);
            fs.unlink(filePath, (err) => {
                if (err) console.error("[Disk] Failed to delete file:", err.message);
            });
        }

        await assetModel.deleteOne({ _id: id });

        // Update storage quota
        const userRecord = await userModel.findById(user._id);
        if (userRecord) {
            userRecord.usedStorage = Math.max(0, userRecord.usedStorage - (asset.size || 0));
            await userRecord.save();
        }

        res.status(200).json({
            message: "Asset deleted successfully",
            assetId: id
        });
    } catch (err) {
        console.error("Delete Asset error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function getStorageSummary(req, res) {
    try {
        const userRecord = await userModel.findById(req.user.id);
        if (!userRecord) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({
            message: "Storage summary calculated successfully",
            totalBytes: userRecord.usedStorage,
            quotaBytes: userRecord.storageQuota
        });
    } catch (err) {
        console.error("Storage summary error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function chatAsset(req, res) {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const user = req.user;

        if (!message) {
            return res.status(400).json({ message: "Message is required" });
        }

        const asset = await assetModel.findOne({
            _id: id,
            $or: [
                { userId: req.user.id },
                { "sharedUsers.userId": req.user.id },
                { publicLinkAccess: { $in: ['view', 'comment', 'edit'] } }
            ]
        });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found or access denied" });
        }

        const contextMessages = [
            {
                role: "user",
                content: `Here is the metadata of the file we are discussing:
Name: ${asset.name}
Type: ${asset.type}
Size: ${(asset.size / (1024 * 1024)).toFixed(2)} MB
Resolution: ${asset.resolution}
Tags: ${asset.tags.join(', ')}
Smart Summary: ${asset.summary}

Please answer questions specifically about this file. Keep the answers concise and professional.`
            },
            {
                role: "user",
                content: message
            }
        ];

        const aiResponse = await aiService.generateResponse(contextMessages);

        res.status(200).json({
            message: "Response generated successfully",
            response: aiResponse
        });
    } catch (err) {
        console.error("Chat Asset error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function createFolder(req, res) {
    try {
        const user = req.user;
        const { name, parentFolderId } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Folder name is required" });
        }

        const folder = await assetModel.create({
            user: user._id,
            userId: user._id,
            name,
            type: "application/vnd.google-apps.folder",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
            parentFolderId: (parentFolderId && parentFolderId !== 'null' && parentFolderId !== 'undefined') ? parentFolderId : null,
            size: 0,
            url: ""
        });

        res.status(201).json({
            message: "Folder created successfully",
            folder
        });
    } catch (err) {
        console.error("Create Folder error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function streamAsset(req, res) {
    try {
        const { id } = req.params;

        const asset = await assetModel.findOne({
            _id: id,
            $or: [
                { userId: req.user.id },
                { "sharedUsers.userId": req.user.id },
                { publicLinkAccess: { $in: ['view', 'comment', 'edit'] } }
            ]
        });

        if (!asset) {
            return res.status(404).json({ message: "Asset not found or access denied" });
        }

        if (asset.megaHandle) {
            try {
                const stream = await megaService.getFileStream(asset.megaHandle);
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.name)}"`);
                res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
                stream.pipe(res);
            } catch (megaErr) {
                console.error("[MEGA] Streaming failed:", megaErr.message);
                res.status(500).json({ message: "Failed to stream file from cloud storage" });
            }
        } else if (asset.url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../../public', asset.url);
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.name)}"`);
                res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.status(404).json({ message: "Local file not found on disk" });
            }
        } else {
            res.redirect(asset.url);
        }
    } catch (err) {
        console.error("Stream Asset error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    uploadAsset,
    getAssets,
    toggleFavorite,
    deleteAsset,
    getStorageSummary,
    chatAsset,
    createFolder,
    streamAsset
};
