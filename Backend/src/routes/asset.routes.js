const express = require('express');
const authMiddleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const assetController = require("../controllers/asset.controller");

const router = express.Router();

/* POST /api/assets/upload */
router.post('/upload', authMiddleware.authUser, uploadMiddleware.single('file'), assetController.uploadAsset);

/* POST /api/assets/folder */
router.post('/folder', authMiddleware.authUser, assetController.createFolder);

/* GET /api/assets/ */
router.get('/', authMiddleware.authUser, assetController.getAssets);

/* GET /api/assets/storage-summary */
router.get('/storage-summary', authMiddleware.authUser, assetController.getStorageSummary);

/* PUT /api/assets/:id/favorite */
router.put('/:id/favorite', authMiddleware.authUser, assetController.toggleFavorite);

/* DELETE /api/assets/:id */
router.delete('/:id', authMiddleware.authUser, assetController.deleteAsset);

/* GET /api/assets/stream/:id */
router.get('/stream/:id', authMiddleware.authUser, assetController.streamAsset);

/* POST /api/assets/:id/chat */
router.post('/:id/chat', authMiddleware.authUser, assetController.chatAsset);

module.exports = router;
