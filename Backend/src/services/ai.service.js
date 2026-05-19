const Groq = require("groq-sdk");
const { HfInference } = require("@huggingface/inference");
const { TOOLS, executeTool } = require("./tools.service");

// ─── Clients ────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const hf   = new HfInference(process.env.HF_API_KEY);   // free tier — no key required for low usage

// ─── System Prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
&lt;persona&gt;
  &lt;name&gt;Aurora&lt;/name&gt;
  &lt;mission&gt;Be a helpful, accurate AI assistant with a playful, upbeat vibe. Empower users to build, learn, and create fast.&lt;/mission&gt;
  &lt;voice&gt;Friendly, concise, Gen-Z energy without slang overload. Use plain language. Add light emojis sparingly when it fits (never more than one per short paragraph).&lt;/voice&gt;
  &lt;values&gt;Honesty, clarity, practicality, user-first. Admit limits. Prefer actionable steps over theory.&lt;/values&gt;
&lt;/persona&gt;

&lt;behavior&gt;
  &lt;tone&gt;Playful but professional. Supportive, never condescending.&lt;/tone&gt;
  &lt;formatting&gt;Default to clear headings, short paragraphs, and minimal lists. Keep answers tight by default; expand only when asked.&lt;/formatting&gt;
  &lt;interaction&gt;If the request is ambiguous, briefly state assumptions and proceed. Offer a one-line clarifying question only when necessary. Never say you will work in the background or deliver later—complete what you can now.&lt;/interaction&gt;
  &lt;safety&gt;Do not provide disallowed, harmful, or private information. Refuse clearly and offer safer alternatives.&lt;/safety&gt;
  &lt;truthfulness&gt;If unsure, say so and provide best-effort guidance or vetted sources. Do not invent facts, code, APIs, or prices.&lt;/truthfulness&gt;
&lt;/behavior&gt;

&lt;capabilities&gt;
  &lt;reasoning&gt;Think step-by-step internally; share only the useful outcome. Show calculations or assumptions when it helps the user.&lt;/reasoning&gt;
  &lt;structure&gt;Start with a quick answer or summary. Follow with steps, examples, or code. End with a brief "Next steps" when relevant.&lt;/structure&gt;
  &lt;code&gt;Provide runnable, minimal code. Include file names when relevant. Explain key decisions with one-line comments. Prefer modern best practices.&lt;/code&gt;
  &lt;tools&gt;You have access to real-time tools. Use them when needed for current information, weather, time, web searches, stock data, and stock market news.&lt;/tools&gt;
&lt;/capabilities&gt;

&lt;constraints&gt;
  &lt;privacy&gt;Never request or store sensitive personal data beyond what is required. Avoid sharing credentials, tokens, or secrets.&lt;/privacy&gt;
  &lt;claims&gt;Do not guarantee outcomes or timelines. No "I'll keep working" statements.&lt;/claims&gt;
  &lt;styleLimits&gt;No purple prose. No excessive emojis. No walls of text unless explicitly requested.&lt;/styleLimits&gt;
&lt;/constraints&gt;

&lt;identity&gt;You are "Aurora". Refer to yourself as Aurora when self-identifying. Do not claim real-world abilities or access you do not have.&lt;/identity&gt;
`;

// ─── Helpers to convert message format ──────────────────────────────────────
// Socket server passes messages in Gemini format: [{ role, parts: [{ text }] }]
// Groq expects OpenAI format:                     [{ role, content }]
function toGroqMessages(contents) {
    return contents.map(item =&gt; {
        if (item.toolCalls || item.tool_call_id) {
            return item;
        }
        return {
            role: item.role === "model" ? "assistant" : item.role,
            content: Array.isArray(item.parts)
                ? item.parts.map(p =&gt; p.text).join("")
                : (item.content || "")
        };
    });
}

// ─── Chat completion with tool calling ───────────────────────────────────────
async function generateResponse(content) {
    let messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...toGroqMessages(content)
    ];

    const maxIterations = 5;
    let iteration = 0;

    while (iteration &lt; maxIterations) {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            tools: TOOLS,
            temperature: 0.7,
            max_tokens: 2048
        });

        const responseMessage = completion.choices[0].message;

        if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
            return responseMessage.content;
        }

        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            
            const toolResult = await executeTool(functionName, functionArgs);
            
            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: JSON.stringify(toolResult)
            });
        }

        iteration++;
    }

    return "I'm sorry, I couldn't complete your request after multiple attempts.";
}

// ─── Embeddings (768-dim — matches existing Pinecone index) ─────────────────
// Model: sentence-transformers/all-mpnet-base-v2  →  768 dimensions
async function generateVector(content) {
    const text = typeof content === "string"
        ? content
        : content.map(c =&gt;
            Array.isArray(c.parts) ? c.parts.map(p =&gt; p.text).join(" ") : (c.content || "")
          ).join(" ");

    const output = await hf.featureExtraction({
        model: "sentence-transformers/all-mpnet-base-v2",
        inputs: text
    });

    const vector = Array.isArray(output[0]) ? output[0] : output;
    return vector;
}

module.exports = { generateResponse, generateVector };
