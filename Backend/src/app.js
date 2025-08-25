const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');


/* Routes */
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require("./routes/chat.routes");


const app = express();

/* using middlewares */
app.use(cors({
    origin: 'http://localhost:5173', // In production, this should be your frontend's deployed URL
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


/*
   Serve static files from the built frontend application.
   The path should point to where your frontend build command places the files.
   For a monorepo structure, this would be relative to the backend.
   Example: '../frontend/dist' or '../client/build'
*/
const frontendBuildPath = path.join(__dirname, '..', 'Frontend', 'dist'); // Example path
app.use(express.static(frontendBuildPath));


/* Using API Routes */
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);


/*
   Catch-all route to serve the index.html for any other requests.
   This is crucial for Single Page Applications (SPAs) with client-side routing.
   It must be the last route defined.
*/
app.get("*", (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});


module.exports = app;