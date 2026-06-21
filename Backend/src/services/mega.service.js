const { Storage } = require('megajs');
const fs = require('fs');

let storageInstance = null;
let isInitializing = false;
let initPromise = null;

async function getStorage() {
    if (storageInstance && storageInstance.ready) {
        return storageInstance;
    }

    const email = process.env.MEGA_EMAIL;
    const password = process.env.MEGA_PASSWORD;

    if (!email || !password) {
        console.warn("[MEGA] MEGA_EMAIL and/or MEGA_PASSWORD not configured. File operations will fall back to local disk.");
        return null;
    }

    if (isInitializing) {
        return initPromise;
    }

    isInitializing = true;
    initPromise = new Promise((resolve, reject) => {
        try {
            const storage = new Storage({
                email,
                password,
                autologin: true
            });

            storage.on('ready', () => {
                console.log("[MEGA] Connected to MEGA storage account successfully.");
                storageInstance = storage;
                isInitializing = false;
                resolve(storage);
            });

            storage.on('error', (err) => {
                console.error("[MEGA] Failed to connect to MEGA storage:", err.message);
                isInitializing = false;
                resolve(null);
            });
        } catch (err) {
            console.error("[MEGA] Initialization threw an error:", err.message);
            isInitializing = false;
            resolve(null);
        }
    });

    return initPromise;
}

/**
 * Upload a file buffer/stream to MEGA
 * @param {string} name - File name
 * @param {number} size - File size in bytes
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} - The MEGA node handle
 */
async function uploadFile(name, size, buffer) {
    const storage = await getStorage();
    if (!storage) {
        throw new Error("MEGA storage is not initialized");
    }

    const file = await storage.upload({
        name: name,
        size: size
    }, buffer).complete;

    return file.handle;
}

/**
 * Delete a file node by its MEGA handle
 * @param {string} handle - MEGA node handle
 */
async function deleteFile(handle) {
    const storage = await getStorage();
    if (!storage) {
        throw new Error("MEGA storage is not initialized");
    }

    const file = storage.files[handle];
    if (file) {
        await file.delete(true); // Permanent deletion
        console.log(`[MEGA] Deleted file node: ${handle}`);
    } else {
        console.warn(`[MEGA] Node handle not found in account files: ${handle}`);
    }
}

/**
 * Stream a file decrypted directly from MEGA
 * @param {string} handle - MEGA node handle
 * @returns {Promise<ReadableStream>} - Readable decryption stream
 */
async function getFileStream(handle) {
    const storage = await getStorage();
    if (!storage) {
        throw new Error("MEGA storage is not initialized");
    }

    const file = storage.files[handle];
    if (!file) {
        throw new Error("File not found in MEGA storage");
    }

    return file.download();
}

module.exports = {
    getStorage,
    uploadFile,
    deleteFile,
    getFileStream
};
