const express = require('express');

const cookieParser = require('cookie-parser');

const cors = require('cors');

const path = require('path');





/* Routes */

const authRoutes = require('./routes/auth.routes');

const chatRoutes = require("./routes/chat.routes");

const assetRoutes = require("./routes/asset.routes");





const app = express();







/* using middlewares */

app.use(cors({
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
    credentials: true
}))

app.use(express.json({ limit: '50mb' }));

app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cookieParser());

app.use(express.static(path.join(__dirname, '../public')));







/* Using Routes */

app.use('/api/auth', authRoutes);

app.use('/api/chat', chatRoutes);

app.use('/api/assets', assetRoutes);






app.get("*name", (req, res) => {
 res.sendFile(path.join(__dirname, '../public/index.html'));
});



module.exports = app;