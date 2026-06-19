# Sahil Drive — AI-Powered Cloud Storage Platform

This project is a refactor of the existing standalone chatbot app currently branded as **SAHIL GPT**. The new product is an AI-enhanced cloud storage experience called **Sahil Drive**, modeled after Google Drive with built-in AI superpowers.

## Project Vision

Sahil Drive is a unified dashboard for storing, browsing, and interacting with media assets. The AI assistant is no longer the primary screen; instead, it is an optional contextual sidebar that helps users search, analyze, summarize, and tag files on demand.

## Project Stack

- Frontend: React, Tailwind CSS, Redux Toolkit, Lucide React
- Backend: Node.js, Express, MongoDB (Mongoose), Socket.io
- Asset Storage: Cloudinary Free Tier (25 GB capacity limit)

## UI Architecture & Layout

The new UI is a responsive 3-column dashboard:

1. **Global Sidebar (Left Column)**
   - Fixed width: `260px`
   - Brand header: `🛡️ Sahil Drive`
   - Primary action: `+ Upload File`
   - Navigation links: `All Files`, `Images`, `Videos`, `Favorites`
   - Bottom storage meter showing `X GB used of 25 GB`

2. **Main Canvas Explorer (Center Workspace)**
   - Flexible width with responsive behavior
   - Top bar includes a global search input: `Search your files, tags, or ask Sahil AI...`
   - User profile icon and `✨ Open Sahil AI` toggle button
   - Breadcrumb header such as `My Files > Recent Uploads`
   - Responsive grid layout: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`
   - File cards include:
     - Media preview thumbnail (Cloudinary image or fallback video placeholder)
     - File title, size, metadata tags
     - Hover overlay with `Analyze with AI`, `Download`, and `Delete`

3. **Sahil AI Assistant Drawer (Right Column)**
   - Width: `380px`, collapsible
   - Smooth open/close transition
   - Condensed chat history layout for narrow sidebar use
   - Quick prompt chips: `🔍 Find my latest image`, `📝 Summarize selected video`, `🏷️ Tag my files`
   - Input placeholder: `Ask Sahil AI to explore, tag, or describe your assets...`

## State & Logic Integration

The frontend should be updated to support the new cloud storage workflow.

1. **AI Drawer Toggle**
   - `isAiOpen` controls the visibility of the right panel
   - `setIsAiOpen` toggles the open/closed state

2. **Selected Asset Context**
   - `activeAssetContext` stores the currently selected asset for AI analysis
   - `setActiveAssetContext` updates this state when a user clicks `Analyze with AI`
   - Clicking `Analyze with AI` should:
     - update `activeAssetContext`
     - open the AI panel automatically
     - provide Cloudinary URL/metadata as hidden context to chat logic

3. **Redux Store Enhancements**
   - Add an `assetSlice.js` alongside the existing `chatSlice.js`
   - Asset state should include:
     - `files` array
     - `uploading` state
     - `storageUsedGB`
     - `storagePercentage`
     - active file metadata / context
   - Use Redux Toolkit patterns to keep state predictable and easy to extend

## High-End Dark-Themed Dashboard Design

- Use a slate and zinc palette for the main UI
- Keep contrast crisp and text readable
- Use glowing accent elements for interactive controls
- Preserve the existing chat logic, but move it into the right-side assistant drawer rather than the main screen

## Suggested Frontend Implementation Outline

- `src/components/layout/Sidebar.jsx` — left navigation and storage meter
- `src/components/layout/MainCanvas.jsx` — search bar, breadcrumbs, file grid
- `src/components/layout/AiDrawer.jsx` — collapsible AI assistant panel
- `src/components/files/FileCard.jsx` — media preview and hover utilities
- `src/store/assetSlice.js` — file and storage state management
- `src/store/chatSlice.js` — existing chat state, enhanced with selected asset context

## Migration Notes

- Rename any `SAHIL GPT` branding to `Sahil Drive` in UI copy and documentation.
- Convert the chatbot-first landing page into a dashboard landing page.
- Preserve existing chat history behavior, but render it in the right-side assistant panel.
- Add an upload workflow that can send files to Cloudinary and update the storage meter.

## Example Dashboard Behavior

- The left sidebar stays fixed while the center grid resizes.
- The AI drawer can slide in as an overlay or push the center content depending on screen width.
- Analyzing a media file opens the AI assistant with that file preloaded for context-aware conversation.
- The storage meter provides a real SaaS feel with progress bar styling and usage text.

## File Naming Recommendation

Create a root-level document like `SAHIL_DRIVE_PROJECT.md` to capture the new product vision and implementation plan. Keep the file as the central spec for this refactor.
