const Groq = require("groq-sdk");
const { HfInference } = require("@huggingface/inference");

let TOOLS = [];
let executeTool = null;

try {
    const toolsModule = require("./tools.service");
    TOOLS = toolsModule.TOOLS || [];
    executeTool = toolsModule.executeTool;
} catch (error) {
    console.warn("[AI] Tools module not available, proceeding without tools:", error.message);
}

// ─── Clients ────────────────────────────────────────────────────────────────
let groq;
try {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} catch (error) {
    console.error("[AI] Groq client initialization failed:", error.message);
}

const hf = new HfInference(process.env.HF_API_KEY);

// ─── System Prompt Template (without date) ───────────────────────────────────
const SYSTEM_PROMPT_TEMPLATE = `
<persona>
  <name>Aurora</name>
  <mission>Be a helpful, accurate AI assistant with a playful, upbeat vibe. Empower users to build, learn, and create fast.</mission>
  <voice>Friendly, concise, Gen-Z energy without slang overload. Use plain language. Add light emojis sparingly when it fits (never more than one per short paragraph).</voice>
  <values>Honesty, clarity, practicality, user-first. Admit limits. Prefer actionable steps over theory.</values>
</persona>

<behavior>
  <tone>Playful but professional. Supportive, never condescending.</tone>
  <formatting>Default to clear headings, short paragraphs, and minimal lists. Keep answers tight by default; expand only when asked.</formatting>
  <interaction>If the request is ambiguous, briefly state assumptions and proceed. Offer a one-line clarifying question only when necessary. Never say you will work in the background or deliver later—complete what you can now.</interaction>
  <safety>Do not provide disallowed, harmful, or private information. Refuse clearly and offer safer alternatives.</safety>
  <truthfulness>If unsure, say so and provide best-effort guidance or vetted sources. Do not invent facts, code, APIs, or prices. Always use the current date/time provided below.</truthfulness>
</behavior>

<capabilities>
  <reasoning>Think step-by-step internally; share only the useful outcome. Show calculations or assumptions when it helps the user.</reasoning>
  <structure>Start with a quick answer or summary. Follow with steps, examples, or code. End with a brief "Next steps" when relevant.</structure>
  <code>Provide runnable, minimal code. Include file names when relevant. Explain key decisions with one-line comments. Prefer modern best practices.</code>
</capabilities>

<constraints>
  <privacy>Never request or store sensitive personal data beyond what is required. Avoid sharing credentials, tokens, or secrets.</privacy>
  <claims>Do not guarantee outcomes or timelines. No "I'll keep working" statements.</claims>
  <styleLimits>No purple prose. No excessive emojis. No walls of text unless explicitly requested.</styleLimits>
  <time>ALWAYS use the current date and time provided below. DO NOT use outdated knowledge cutoff dates.</time>
</constraints>

<identity>You are "Aurora". Refer to yourself as Aurora when self-identifying.</identity>

<current_context>
  CURRENT_DATE: {CURRENT_DATE}
  CURRENT_TIME: {CURRENT_TIME}
  CURRENT_DATETIME: {CURRENT_DATETIME}
  IMPORTANT: Use these current date/time values for ALL time-related questions and context.
</current_context>
`;

// ─── Get dynamic system prompt with current date/time ─────────────────────────
function getSystemPrompt() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    const currentDateTime = now.toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return SYSTEM_PROMPT_TEMPLATE
        .replace('{CURRENT_DATE}', currentDate)
        .replace('{CURRENT_TIME}', currentTime)
        .replace('{CURRENT_DATETIME}', currentDateTime);
}

// ─── Helpers to convert message format ──────────────────────────────────────
function toGroqMessages(contents) {
    if (!Array.isArray(contents)) return [];
    
    return contents.map(item => {
        if (!item) return { role: "user", content: "" };
        if (item.toolCalls || item.tool_call_id) {
            return item;
        }
        return {
            role: item.role === "model" ? "assistant" : item.role,
            content: Array.isArray(item.parts)
                ? item.parts.map(p => p.text).join("")
                : (item.content || "")
        };
    });
}

// ─── Ultimate fallback response (always works) ───────────────────────────────
function getFallbackResponse(userMessage) {
    const responses = [
        "Hi there! I'm Aurora, your AI assistant. How can I help you today?",
        "Hello! I'm here to help. What would you like to know?",
        "Hey! I'm Aurora. Feel free to ask me anything!",
        "Hi! I'd be happy to help you. What's on your mind?",
        "Hello there! I'm Aurora, ready to assist you with whatever you need!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
}

// ─── Chat completion WITHOUT tools (simpler, more reliable) ─────────────────
async function generateResponseWithoutTools(content) {
    try {
        if (!groq) {
            console.warn("[AI] Groq client not available, using fallback");
            return getFallbackResponse(content);
        }

        const messages = [
            { role: "system", content: getSystemPrompt() },
            ...toGroqMessages(content)
        ];

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.7,
            max_tokens: 1024
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error("No content in response");
        }
        return responseContent;
    } catch (error) {
        console.error("[AI] Error in generateResponseWithoutTools:", error.message);
        return getFallbackResponse(content);
    }
}

// ─── Chat completion WITH tools (try first, then fallback) ───────────────────
async function generateResponseWithTools(content) {
    try {
        if (!groq || TOOLS.length === 0 || !executeTool) {
            console.warn("[AI] Tools not available, using no-tools mode");
            return await generateResponseWithoutTools(content);
        }

        let messages = [
            { role: "system", content: getSystemPrompt() },
            ...toGroqMessages(content)
        ];

        const maxIterations = 2;
        let iteration = 0;

        while (iteration < maxIterations) {
            console.log("[AI] Tool calling iteration:", iteration + 1);
            
            const completion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages,
                tools: TOOLS,
                temperature: 0.7,
                max_tokens: 1024
            });

            const responseMessage = completion.choices[0].message;

            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
                return responseMessage.content;
            }

            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                console.log("[AI] Executing tool:", functionName);
                
                try {
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    const toolResult = await executeTool(functionName, functionArgs);
                    
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: functionName,
                        content: JSON.stringify(toolResult)
                    });
                } catch (toolError) {
                    console.error("[AI] Tool execution error:", toolError.message);
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: functionName,
                        content: JSON.stringify({ error: toolError.message })
                    });
                }
            }

            iteration++;
        }

        return await generateResponseWithoutTools(content);
    } catch (error) {
        console.error("[AI] Error in generateResponseWithTools:", error.message);
        return await generateResponseWithoutTools(content);
    }
}

// ─── MAIN generateResponse with MULTIPLE FALLBACKS ───────────────────────────
async function generateResponse(content) {
    try {
        return await generateResponseWithTools(content);
    } catch (error) {
        console.warn("[AI] All methods failed, using ultimate fallback:", error.message);
        return getFallbackResponse(content);
    }
}

// ─── Embeddings (with fallback) ──────────────────────────────────────────────
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

module.exports = { generateResponse, generateVector };
