# 🚀 Render Redeployment Guide

This guide contains step-by-step instructions to configure and redeploy your newly updated AI Chat & Memory application on Render.

Your codebase has been fully upgraded to use:
*   **AI Chat:** Groq (`llama-3.3-70b-versatile`)
*   **Memory Embeddings:** Hugging Face (`sentence-transformers/all-mpnet-base-v2`)
*   **Vector Storage:** Pinecone (with a 100% crash-resilient fail-safe wrapper)
*   **Authentication & Security:** Secure session cookie-based authorization for Socket.io and Axios

---

## 🛠️ Step 1: Push the Code (DONE)
We have already successfully initialized Git locally, staged all the backend and frontend changes, committed them, and pushed them to your GitHub repository:
👉 [https://github.com/Rexanimation/gpt](https://github.com/Rexanimation/gpt) *(Branch: `main`)*

Render will automatically see these new changes when you trigger a redeployment.

---

## 🔑 Step 2: Configure Environment Variables on Render
Your Render web service needs the new Groq and Hugging Face credentials, as well as your updated MongoDB connection URI.

1. Go to your **[Render Dashboard](https://dashboard.render.com)**.
2. Select your **gpt** Web Service.
3. Click on the **Environment** tab on the left sidebar.
4. Click the **Edit** button in the **Environment Variables** section.
5. Apply the following changes:

### 📋 Environment Variables Table

| Action | Key | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **➕ ADD** | `GEMINI_API_KEY` | `<your_gemini_api_key>` | Google Gemini API Key for Sahil AI and Tagging. |
| **❌ DELETE** | `GROQ_API_KEY` | *(Remove this key entirely)* | No longer used. Switched to Gemini. |
| **➕ ADD** | `HF_API_KEY` | `<your_huggingface_api_key>` | Hugging Face Serverless Inference Key. |
| **✏️ UPDATE** | `MONGO_URI` | `mongodb+srv://nickleister402:<your_password>@cluster0.fimf5jp.mongodb.net/?appName=Cluster0` | Correct, fully qualified MongoDB connection string. |
| **✏️ UPDATE** | `PINECONE_API_KEY` | `<your_pinecone_api_key>` | Your Pinecone API Key (corrected from screenshot). |
| **➕ ADD** | `PINECONE_INDEX` | `cohort-chat-gpt` | The name of your active Pinecone index. |

> [!NOTE]
> We implemented **fail-safe error handlers** in both `vector.service.js` and `socket.server.js`.
> Even if your Pinecone API Key or index is deactivated, expired, or rate-limited, the application will **automatically fallback gracefully** and continue functioning perfectly instead of hanging or throwing errors.


6. Scroll down and click **Save Changes**.

---

## 🚀 Step 3: Trigger a Fresh Deploy
Render will automatically trigger a build once you save your environment variables. To monitor the progress or trigger it manually:

1. Click on the **Manual Deploy** button in the top-right corner of your Render Web Service page.
2. Click **Clear build cache & deploy** (this guarantees all new npm packages like `@huggingface/inference` and `groq-sdk` are installed fresh).
3. Open the build logs to watch the server start up!

Once the build finishes successfully, your live application will be updated and 100% operational! 🎉
