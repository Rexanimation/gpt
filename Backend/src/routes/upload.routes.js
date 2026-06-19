const express = require('express');
const multer = require('multer');
const authMiddleware = require("../middlewares/auth.middleware");
const uploadController = require("../controllers/upload.controller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* POST /api/upload/initiate */
router.post('/initiate', authMiddleware.authUser, uploadController.initiateUpload);

/* POST /api/upload/chunk */
router.post('/chunk', authMiddleware.authUser, upload.single('chunk'), uploadController.uploadChunk);

/* POST /api/upload/finalize */
router.post('/finalize', authMiddleware.authUser, uploadController.finalizeUpload);

module.exports = router;
