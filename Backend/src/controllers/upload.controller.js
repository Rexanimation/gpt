const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const assetModel = require('../models/asset.model');
const aiService = require('../services/ai.service');

const tempUploadsDir = path.join(__dirname, '../../public/temp_uploads');
const uploadsDir = path.join(__dirname, '../../public/uploads');

// Ensure directories exist
if (!fs.existsSync(tempUploadsDir)) {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

async function initiateUpload(req, res) {
    try {
        const { name, size, type } = req.body;
        if (!name || !size) {
            return res.status(400).json({ message: "File name and size are required" });
        }

        const uploadId = crypto.randomUUID();
        const uploadFolder = path.join(tempUploadsDir, uploadId);
        fs.mkdirSync(uploadFolder, { recursive: true });

        res.status(200).json({
            message: "Upload initiated successfully",
            uploadId
        });
    } catch (err) {
        console.error("Initiate upload error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function uploadChunk(req, res) {
    try {
        const { uploadId, chunkIndex } = req.body;
        if (!uploadId || chunkIndex === undefined) {
            return res.status(400).json({ message: "uploadId and chunkIndex are required" });
        }
        if (!req.file) {
            return res.status(400).json({ message: "No chunk buffer was provided" });
        }

        const uploadFolder = path.join(tempUploadsDir, uploadId);
        if (!fs.existsSync(uploadFolder)) {
            return res.status(404).json({ message: "Upload session not found or expired" });
        }

        const chunkPath = path.join(uploadFolder, chunkIndex.toString());
        fs.writeFileSync(chunkPath, req.file.buffer);

        res.status(200).json({
            message: `Chunk ${chunkIndex} uploaded successfully`,
            success: true
        });
    } catch (err) {
        console.error("Upload chunk error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function finalizeUpload(req, res) {
    try {
        const user = req.user;
        const { uploadId, totalChunks, name, type, size, parentFolderId } = req.body;

        if (!uploadId || !totalChunks || !name || !type || !size) {
            return res.status(400).json({ message: "Missing required compilation parameters" });
        }

        const uploadFolder = path.join(tempUploadsDir, uploadId);
        if (!fs.existsSync(uploadFolder)) {
            return res.status(404).json({ message: "Upload session not found" });
        }

        // Generate unique filename in upload directory
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(name);
        const finalFileName = uniqueSuffix + fileExt;
        const finalFilePath = path.join(uploadsDir, finalFileName);

        const writeStream = fs.createWriteStream(finalFilePath);

        // Concatenate chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(uploadFolder, i.toString());
            if (!fs.existsSync(chunkPath)) {
                writeStream.end();
                return res.status(400).json({ message: `Missing chunk partition segment ${i}` });
            }
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }
        writeStream.end();

        // Wait for streaming completion
        await new Promise((resolve) => {
            writeStream.on('finish', resolve);
        });

        // Clean up temporary chunks
        fs.rmSync(uploadFolder, { recursive: true, force: true });

        const url = `/uploads/${finalFileName}`;

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
            resolution: analysis.resolution || "Unknown",
            parentFolderId: (parentFolderId && parentFolderId !== 'null' && parentFolderId !== 'undefined') ? parentFolderId : null,
            mimeType: type,
            isFolder: false
        });

        res.status(201).json({
            message: "Upload finalized and analyzed successfully",
            asset
        });
    } catch (err) {
        console.error("Finalize upload error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    initiateUpload,
    uploadChunk,
    finalizeUpload
};
