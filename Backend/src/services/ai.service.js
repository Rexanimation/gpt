const Groq = require("groq-sdk");
const { HfInference } = require("@huggingface/inference");
const assetModel = require("../models/asset.model");
const userModel = require("../models/user.model");

// Initialize Groq
let groq = null;
if (process.env.GROQ_API_KEY) {
    try {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } catch (err) {
        console.error("[AI] Failed to initialize Groq SDK:", err.message);
    }
} else {
    console.warn("[AI] GROQ_API_KEY is not defined in the environment.");
}

// Initialize Hugging Face for Embeddings (pinecone dependency)
const hf = new HfInference(process.env.HF_API_KEY);

// Groq Model configuration
const GROQ_MODEL = "llama-3.3-70b-versatile";

// System Prompt for Sahil AI
const SYSTEM_PROMPT = `
You are "Sahil AI" (also referred to as Sahil GPT), an expert full-stack developer and AI-powered cloud storage assistant.
Mission: Help users store, organize, analyze, and retrieve files within their digital vault on Sahil Drive.
Voice & Tone: Playful, professional, highly capable, supportive.
Current context: Use the current date and time for any queries about "recent visuals" or uploads.
Always answer questions concisely and structure replies with clean markdown.
`;

// Helper to convert conversation history into Groq chat history format
function toGroqHistory(contents) {
    if (!Array.isArray(contents)) return [];
    return contents.map(item => {
        const role = (item.role === "assistant" || item.role === "model") ? "assistant" : "user";
        let text = "";
        if (Array.isArray(item.parts)) {
            text = item.parts.map(p => p.text).join("");
        } else if (typeof item.content === "string") {
            text = item.content;
        }
        return {
            role,
            content: text
        };
    });
}

// Generate Chat Response using Groq with Function Calling (Tools)
async function generateResponse(content, folderContextString = "", context = {}) {
    try {
        if (!groq) {
            throw new Error("Groq API key is not configured.");
        }

        let systemInstruction = SYSTEM_PROMPT;
        if (folderContextString) {
            systemInstruction += `\n\n[Active Directory Context]\nThe user is currently browsing a folder containing these files:\n${folderContextString}`;
        }

        const messages = [
            { role: "system", content: systemInstruction },
            ...toGroqHistory(content)
        ];

        if (messages.length === 1) {
            return "Hello! I am Sahil AI. How can I assist you with your files today?";
        }

        // Define tools for Sahil GPT project controller
        const tools = [
            {
                type: "function",
                function: {
                    name: "create_folder",
                    description: "Create a new folder (directory) in the cloud drive.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "The folder name to create." },
                            parentFolderId: { type: "string", description: "The parent folder ID (optional). If not provided, it will create in the current directory." }
                        },
                        required: ["name"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_storage_summary",
                    description: "Get user's storage usage details, limit, and remaining quota.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "find_unused_files",
                    description: "Search for unused, non-favorite, or large files that can be suggested for deletion.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            }
        ];

        let response = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        });

        let responseMessage = response.choices[0].message;

        // Process function calls sequentially if requested by Groq
        while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const name = toolCall.function.name;
                let args = {};
                try {
                    args = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                    console.error("[Groq] Failed to parse tool arguments:", toolCall.function.arguments);
                }

                console.log(`[Groq Tool Call] Executing tool ${name} with args:`, args);
                const toolOutput = await executeLocalTool(name, args, context);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: name,
                    content: JSON.stringify(toolOutput)
                });
            }

            response = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages: messages,
                tools: tools
            });
            responseMessage = response.choices[0].message;
        }

        return responseMessage.content || "";
    } catch (error) {
        console.error("[Groq] generateResponse error:", error.message);
        return "Sorry, I encountered an issue generating a response. Please verify that your GROQ_API_KEY is configured correctly.";
    }
}

// Local helper to execute functions on backend Mongoose models
async function executeLocalTool(name, args, context) {
    const { userId, parentFolderId, socket } = context;
    if (!userId) {
        return { error: "User is not authenticated." };
    }

    switch (name) {
        case "create_folder":
            try {
                const folderName = args.name;
                const parentId = args.parentFolderId || parentFolderId || null;
                const finalParentId = (parentId === 'root' || parentId === 'null' || parentId === 'undefined') ? null : parentId;

                const newFolder = await assetModel.create({
                    user: userId,
                    userId: userId,
                    name: folderName,
                    type: "application/vnd.google-apps.folder",
                    mimeType: "application/vnd.google-apps.folder",
                    isFolder: true,
                    parentFolderId: finalParentId,
                    size: 0,
                    url: ""
                });

                // Notify frontend to refresh lists in real-time
                if (socket) {
                    socket.emit("refresh-assets");
                }

                return {
                    success: true,
                    message: `Folder '${folderName}' created successfully.`,
                    folderId: newFolder._id.toString()
                };
            } catch (err) {
                return { error: `Failed to create folder: ${err.message}` };
            }

        case "get_storage_summary":
            try {
                const user = await userModel.findById(userId);
                if (!user) return { error: "User not found." };
                const usedMB = (user.usedStorage / (1024 * 1024)).toFixed(2);
                const quotaMB = (user.storageQuota / (1024 * 1024)).toFixed(2);
                const remainingMB = ((user.storageQuota - user.usedStorage) / (1024 * 1024)).toFixed(2);
                
                return {
                    success: true,
                    usedMB,
                    quotaMB,
                    remainingMB,
                    message: `Used: ${usedMB} MB, Quota: ${quotaMB} MB, Remaining: ${remainingMB} MB.`
                };
            } catch (err) {
                return { error: `Failed to retrieve storage: ${err.message}` };
            }

        case "find_unused_files":
            try {
                // Find up to 5 large files that are not folders and not favorites
                const files = await assetModel.find({
                    userId,
                    isFolder: false,
                    isFavorite: false
                }).sort({ size: -1 }).limit(5).lean();

                return {
                    success: true,
                    files: files.map(f => ({
                        id: f._id.toString(),
                        name: f.name,
                        sizeMB: (f.size / (1024 * 1024)).toFixed(2),
                        tags: f.tags,
                        createdAt: f.createdAt
                    }))
                };
            } catch (err) {
                return { error: `Failed to scan unused files: ${err.message}` };
            }

        default:
            return { error: `Function ${name} is not implemented.` };
    }
}

// Analyze File Details (generate tags, summaries, colors, and resolutions)
async function analyzeAsset(fileName, fileType, fileSize) {
    try {
        if (!groq) {
            throw new Error("Groq API key is not configured.");
        }

        const prompt = `Analyze this file metadata for a cloud storage platform (Sahil Drive).
File Name: ${fileName}
File Type: ${fileType}
File Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB

Provide a JSON response containing:
1. "tags": An array of 4 to 6 relevant tags (like "Sunset", "Beach", "Ocean", "Nature" - do NOT prepend them with the '#' symbol).
2. "summary": A 2-3 sentence smart summary of what the file likely represents, written in a high-end SaaS tone. Use the name "Sahil AI" to describe yourself when referring to the analysis, e.g. "Sahil AI detects...".
3. "colors": An array of 2 primary hex colors matching the theme of the file.
4. "resolution": A typical high-quality resolution (like "4096 x 2304" for 4K image, or a suitable resolution for the file type, e.g., "1920 x 1080 (1080p)" for video).

Respond ONLY with the JSON object. Do not include markdown formatting or wrappers.`;

        const response = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" }
        });

        let text = response.choices[0].message.content.trim();

        // Strip markdown code block markers if present
        if (text.startsWith("```json")) {
            text = text.substring(7);
        }
        if (text.startsWith("```")) {
            text = text.substring(3);
        }
        if (text.endsWith("```")) {
            text = text.substring(0, text.length - 3);
        }
        text = text.trim();

        return JSON.parse(text);
    } catch (error) {
        console.error("[Groq] analyzeAsset error:", error.message);
        const isVideo = fileType.startsWith("video/");
        return {
            tags: isVideo ? ["Demo", "Clip", "Video"] : ["Image", "Visual", "Asset"],
            summary: `This is an uploaded file named ${fileName}. Sahil AI detects standard parameters.`,
            colors: ["#06B6D4", "#7C3AED"],
            resolution: isVideo ? "1920 x 1080 (1080p)" : "3840 x 2160 (4K)"
        };
    }
}


// Embeddings Generation for Pinecone Long-Term Memory
async function generateVector(content) {
    try {
        const text = typeof content === "string"
            ? content
            : (Array.isArray(content) ? content.map(c =>
                Array.isArray(c.parts) ? c.parts.map(p => p.text).join(" ") : (c.content || "")
              ).join(" ") : "");

        const output = await hf.featureExtraction({
            model: "sentence-transformers/all-mpnet-base-v2",
            inputs: text
        });

        const vector = Array.isArray(output[0]) ? output[0] : output;
        return vector;
    } catch (error) {
        console.error("[HF Inference] Error generating vector:", error.message);
        return null;
    }
}

module.exports = {
    generateResponse,
    generateVector,
    analyzeAsset
};
