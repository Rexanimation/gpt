const { Server } = require("socket.io");
const cookie = require("cookie")
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const aiService = require("../services/ai.service")
const messageModel = require("../models/message.model");
const { createMemory, queryMemory } = require("../services/vector.service")
const assetModel = require("../models/asset.model");


function initSocketServer(httpServer) {

    const io = new Server(httpServer, {
        cors: {
            origin: function (origin, callback) {
                if (!origin) return callback(null, true);
                if (
                    origin.includes("localhost") || 
                    origin.includes("127.0.0.1") || 
                    origin.includes("onrender.com")
                ) {
                    return callback(null, true);
                }
                callback(new Error('Not allowed by CORS'));
            },
            allowedHeaders: [ "Content-Type", "Authorization" ],
            credentials: true
        }
    })

    // ─── Auth middleware ────────────────────────────────────────────────────────
    io.use(async (socket, next) => {

        const cookies = cookie.parse(socket.handshake.headers?.cookie || "");

        if (!cookies.token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);
            const user = await userModel.findById(decoded.id);
            if (!user) return next(new Error("Authentication error: User not found"));
            socket.user = user;
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }

    })

    // ─── Connection handler ─────────────────────────────────────────────────────
    io.on("connection", (socket) => {

        socket.on("ai-message", async (messagePayload) => {
            /* messagePayload = { chat: chatId, content: message text, folderId: parentFolderId } */

            try {
                const userId   = socket.user._id.toString();
                const chatId   = messagePayload.chat.toString();
                const userText = messagePayload.content;

                // A. Check if the message is a slash command: /summarize <filename>
                const summarizeMatch = userText.trim().match(/^\/summarize\s+(.+)$/i);
                if (summarizeMatch) {
                    const fileName = summarizeMatch[1].trim();
                    const asset = await assetModel.findOne({
                        user: userId,
                        name: { $regex: new RegExp('^' + fileName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
                    });

                    let response = "";
                    if (!asset) {
                        response = `Could not find file named "${fileName}" in your drive. Please make sure the filename matches exactly.`;
                    } else {
                        const summarizePrompt = `Please summarize the following file in detail:\n` +
                            `Name: ${asset.name}\n` +
                            `Type: ${asset.type}\n` +
                            `Size: ${(asset.size / (1024 * 1024)).toFixed(2)} MB\n` +
                            `Resolution: ${asset.resolution}\n` +
                            `Tags: ${asset.tags.join(', ')}\n` +
                            `Original Summary: ${asset.summary}\n\n` +
                            `Format your output as a professional summary, highlighting the key aspects, themes, and potential uses of this file.`;

                        response = await aiService.generateResponse([
                            {
                                role: "user",
                                parts: [{ text: summarizePrompt }]
                            }
                        ]);
                    }

                    // Save both user command and AI response to the DB
                    const [userMsg, responseMsg] = await Promise.all([
                        messageModel.create({
                            chat: chatId,
                            user: userId,
                            content: userText,
                            role: "user"
                        }),
                        messageModel.create({
                            chat: chatId,
                            user: userId,
                            content: response,
                            role: "model"
                        })
                    ]);

                    // Generate vectors for both in parallel (non-blocking Pinecone update)
                    Promise.all([
                        aiService.generateVector(userText).then(v => {
                            if (v) createMemory({ vectors: v, messageId: userMsg._id, metadata: { chat: chatId, user: userId, text: userText, role: "user" } });
                        }),
                        aiService.generateVector(response).then(v => {
                            if (v) createMemory({ vectors: v, messageId: responseMsg._id, metadata: { chat: chatId, user: userId, text: response, role: "model" } });
                        })
                    ]).catch(err => console.error("Error creating vector memory for /summarize:", err.message));

                    // Send response to frontend
                    socket.emit("ai-response", {
                        content: response,
                        chat: chatId
                    });
                    return;
                }

                // B. Fetch Folder Context String
                let folderContextString = "";
                if (messagePayload.folderId) {
                    const parentFolderId = (messagePayload.folderId === 'root' || messagePayload.folderId === 'null') ? null : messagePayload.folderId;
                    const folderAssets = await assetModel.find({ user: userId, parentFolderId }).lean();
                    if (folderAssets && folderAssets.length > 0) {
                        folderContextString = folderAssets.map(asset => `• ${asset.isFolder ? '[Folder]' : '[File]'} Name: ${asset.name}, Type: ${asset.type}, Size: ${(asset.size / (1024 * 1024)).toFixed(2)} MB, Tags: ${asset.tags.join(', ')}, Summary: ${asset.summary}`).join("\n");
                    }
                }

                // 1️⃣ Save user message to DB + generate embedding (parallel with safe catch)
                const [ message, vectors ] = await Promise.all([
                    messageModel.create({
                        chat: chatId,
                        user: userId,
                        content: userText,
                        role: "user"
                    }),
                    aiService.generateVector(userText).catch(err => {
                        console.error("[HF Inference] Error generating vector:", err.message);
                        return null; // fallback gracefully
                    }),
                ])

                // 2️⃣ Store user message embedding in Pinecone (only if embedding generation succeeded)
                if (vectors) {
                    await createMemory({
                        vectors,
                        messageId: message._id,
                        metadata: {
                            chat: chatId,          // string ✓
                            user: userId,          // string ✓
                            text: userText,
                            role: "user"
                        }
                    })
                }

                // 3️⃣ Search long-term memory + fetch recent chat history (parallel)
                const [ memory, chatHistory ] = await Promise.all([
                    vectors
                        ? queryMemory({
                            queryVector: vectors,
                            limit: 5,
                            metadata: { user: { "$eq": userId } }   // Pinecone filter syntax
                          })
                        : Promise.resolve([]),
                    messageModel
                        .find({ chat: chatId })
                        .sort({ createdAt: -1 })
                        .limit(20)
                        .lean()
                        .then(msgs => msgs.reverse())
                ])

                // 4️⃣ Build short-term memory (recent chat history — Gemini → Groq format handled in ai.service)
                const stm = chatHistory.map(item => ({
                    role: item.role,           // "user" | "model" (converted in ai.service)
                    parts: [ { text: item.content } ]
                }))

                // 5️⃣ Build long-term memory context from Pinecone results (only if memory is valid array)
                const ltm = (Array.isArray(memory) && memory.length > 0)
                    ? [{
                        role: "user",
                        parts: [{
                            text: `[Previous conversation context — use for reference only]\n${
                                memory.map(m => `• ${m.metadata.role === "model" ? "AI" : "User"}: ${m.metadata.text}`).join("\n")
                            }`
                        }]
                    }]
                    : []   // skip if no memory yet

                // 6️⃣ Generate AI response (passing folderContextString as parameter)
                const response = await aiService.generateResponse([ ...ltm, ...stm ], folderContextString)

                // 7️⃣ Send response to frontend immediately
                socket.emit("ai-response", {
                    content: response,
                    chat: chatId
                })

                // 8️⃣ Save AI response to DB + store its embedding in Pinecone (parallel with safe catch)
                const [ responseMessage, responseVectors ] = await Promise.all([
                    messageModel.create({
                        chat: chatId,
                        user: userId,
                        content: response,
                        role: "model"
                    }),
                    aiService.generateVector(response).catch(err => {
                        console.error("[HF Inference] Error generating vector:", err.message);
                        return null; // fallback gracefully
                    })
                ])

                if (responseVectors) {
                    await createMemory({
                        vectors: responseVectors,
                        messageId: responseMessage._id,
                        metadata: {
                            chat: chatId,          // string ✓
                            user: userId,          // string ✓
                            text: response,
                            role: "model"
                        }
                    })
                }

            } catch (err) {
                console.error("[socket] ai-message error:", err.message);
                socket.emit("ai-error", { message: "Something went wrong. Please try again." });
            }

        })

    })
}


module.exports = initSocketServer;