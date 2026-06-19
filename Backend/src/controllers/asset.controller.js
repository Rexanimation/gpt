const assetModel = require('../models/asset.model');
const aiService = require('../services/ai.service');
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
        
        // Relative path exposed statically
        const url = `/uploads/${req.file.filename}`;

        // Call Gemini to generate tags, summary, dominant colors, and resolution
        const analysis = await aiService.analyzeAsset(name, type, size);

        const asset = await assetModel.create({
            user: user._id,
            name,
            type,
            size,
            url,
            tags: analysis.tags || [],
            summary: analysis.summary || "",
            colors: analysis.colors || [],
            resolution: analysis.resolution || "Unknown"
        });

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
        const { type, favorite, search } = req.query;

        let query = { user: user._id };

        if (type === 'image') {
            query.type = { $regex: '^image/', $options: 'i' };
        } else if (type === 'video') {
            query.type = { $regex: '^video/', $options: 'i' };
        }

        if (favorite === 'true') {
            query.isFavorite = true;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        let assets = await assetModel.find(query).sort({ createdAt: -1 });

        // Auto-seed if no assets exist for this user in general
        if (assets.length === 0 && !type && !favorite && !search) {
            const userAssetsCount = await assetModel.countDocuments({ user: user._id });
            if (userAssetsCount === 0) {
                const seeded = SEED_ASSETS.map(asset => ({
                    ...asset,
                    user: user._id
                }));
                await assetModel.insertMany(seeded);
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

        const asset = await assetModel.findOne({ _id: id, user: user._id });
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

        const asset = await assetModel.findOne({ _id: id, user: user._id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found" });
        }

        // Delete from local disk if it's stored locally
        if (asset.url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../../public', asset.url);
            fs.unlink(filePath, (err) => {
                if (err) console.error("[Disk] Failed to delete file:", err.message);
            });
        }

        await assetModel.deleteOne({ _id: id });

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
        const user = req.user;

        const result = await assetModel.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: null, totalBytes: { $sum: "$size" } } }
        ]);

        const totalBytes = result.length > 0 ? result[0].totalBytes : 0;

        res.status(200).json({
            message: "Storage summary calculated successfully",
            totalBytes
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

        const asset = await assetModel.findOne({ _id: id, user: user._id });
        if (!asset) {
            return res.status(404).json({ message: "Asset not found" });
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

module.exports = {
    uploadAsset,
    getAssets,
    toggleFavorite,
    deleteAsset,
    getStorageSummary,
    chatAsset
};
