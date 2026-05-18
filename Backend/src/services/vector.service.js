// Import the Pinecone library
const { Pinecone } = require('@pinecone-database/pinecone')

let pc;
let cohortChatGptIndex;

try {
    if (process.env.PINECONE_API_KEY) {
        // Initialize a Pinecone client with your API key
        pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        cohortChatGptIndex = pc.Index('cohort-chat-gpt');
    }
} catch (err) {
    console.error("[Pinecone] Initialization error:", err.message);
}

async function createMemory({ vectors, metadata, messageId }) {
    if (!cohortChatGptIndex) {
        console.warn("[Pinecone] Memory not saved: Pinecone is not initialized.");
        return;
    }
    try {
        await cohortChatGptIndex.upsert([ {
            id: messageId.toString(),   // Pinecone requires string ID; MongoDB _id is an ObjectId
            values: vectors,
            metadata
        } ]);
    } catch (err) {
        console.error("[Pinecone] Error saving memory (upsert):", err.message);
        // Fail silently so the rest of the application remains operational
    }
}


async function queryMemory({ queryVector, limit = 5, metadata }) {
    if (!cohortChatGptIndex) {
        console.warn("[Pinecone] Memory query skipped: Pinecone is not initialized.");
        return [];
    }
    try {
        const data = await cohortChatGptIndex.query({
            vector: queryVector,
            topK: limit,
            filter: metadata ? metadata : undefined,
            includeMetadata: true
        });

        return data.matches || [];
    } catch (err) {
        console.error("[Pinecone] Error querying memory (query):", err.message);
        // Return empty array to fall back gracefully to short-term memory
        return [];
    }
}

module.exports = { createMemory, queryMemory }