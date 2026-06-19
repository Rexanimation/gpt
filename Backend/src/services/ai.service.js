const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HfInference } = require("@huggingface/inference");

// Initialize Gemini
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (err) {
        console.error("[AI] Failed to initialize Gemini SDK:", err.message);
    }
} else {
    console.warn("[AI] GEMINI_API_KEY is not defined in the environment.");
}

// Initialize Hugging Face for Embeddings (pinecone dependency)
const hf = new HfInference(process.env.HF_API_KEY);

// System Prompt for Sahil AI
const SYSTEM_PROMPT = `
You are "Sahil AI" (also referred to as Sahil GPT), an expert full-stack developer and AI-powered cloud storage assistant.
Mission: Help users store, organize, analyze, and retrieve files within their digital vault on Sahil Drive.
Voice & Tone: Playful, professional, highly capable, supportive.
Current context: Use the current date and time for any queries about "recent visuals" or uploads.
Always answer questions concisely and structure replies with clean markdown.
`;

// Helper to convert conversation history into Gemini SDK format
function toGeminiHistory(contents) {
    if (!Array.isArray(contents)) return [];
    return contents.map(item => {
        const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
        let text = "";
        if (Array.isArray(item.parts)) {
            text = item.parts.map(p => p.text).join("");
        } else if (typeof item.content === "string") {
            text = item.content;
        }
        return {
            role,
            parts: [{ text }]
        };
    });
}

// Generate Chat Response using Gemini
async function generateResponse(content) {
    try {
        if (!genAI) {
            throw new Error("Gemini API key is not configured.");
        }
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: SYSTEM_PROMPT
        });

        const chatMessages = toGeminiHistory(content);
        
        // Split history from the latest message
        if (chatMessages.length === 0) {
            return "Hello! I am Sahil AI. How can I assist you with your files today?";
        }
        
        const latestMessage = chatMessages.pop();
        const chat = model.startChat({
            history: chatMessages
        });

        const result = await chat.sendMessage(latestMessage.parts[0].text);
        return result.response.text();
    } catch (error) {
        console.error("[Gemini] generateResponse error:", error.message);
        return "Sorry, I encountered an issue generating a response. Please verify that your GEMINI_API_KEY is configured correctly.";
    }
}

// Analyze File Details (generate tags, summaries, colors, and resolutions)
async function analyzeAsset(fileName, fileType, fileSize) {
    try {
        if (!genAI) {
            throw new Error("Gemini API key is not configured.");
        }
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Analyze this file metadata for a cloud storage platform (Sahil Drive).
File Name: ${fileName}
File Type: ${fileType}
File Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB

Provide a JSON response containing:
1. "tags": An array of 4 to 6 relevant tags (like "#Sunset", "#Beach", "#Ocean", "#Nature").
2. "summary": A 2-3 sentence smart summary of what the file likely represents, written in a high-end SaaS tone. Use the name "Sahil AI" to describe yourself when referring to the analysis, e.g. "Sahil AI detects...".
3. "colors": An array of 2 primary hex colors matching the theme of the file.
4. "resolution": A typical high-quality resolution (like "4096 x 2304" for 4K image, or a suitable resolution for the file type, e.g., "1920 x 1080 (1080p)" for video).

Respond ONLY with the JSON object. Do not include markdown formatting or wrappers.`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();

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
        console.error("[Gemini] analyzeAsset error:", error.message);
        const isVideo = fileType.startsWith("video/");
        return {
            tags: isVideo ? ["#Demo", "#Clip", "#Video"] : ["#Image", "#Visual", "#Asset"],
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
