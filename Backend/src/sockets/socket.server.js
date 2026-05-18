const { Server } = require("socket.io");
const cookie = require("cookie")
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const aiService = require("../services/ai.service")
const messageModel = require("../models/message.model");
const { createMemory, queryMemory } = require("../services/vector.service")


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
            /* messagePayload = { chat: chatId, content: message text } */

            try {
                const userId   = socket.user._id.toString();
                const chatId   = messagePayload.chat.toString();
                const userText = messagePayload.content;

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

                // 6️⃣ Generate AI response
                const response = await aiService.generateResponse([ ...ltm, ...stm ])

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