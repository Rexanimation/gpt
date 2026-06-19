const express = require('express');
const authMiddleware = require("../middlewares/auth.middleware");
const assetController = require("../controllers/asset.controller");

const router = express.Router();

/* POST /api/assets/upload */
router.post('/upload', authMiddleware.authUser, assetController.uploadAsset);

/* GET /api/assets/ */
router.get('/', authMiddleware.authUser, assetController.getAssets);

/* PUT /api/assets/:id/favorite */
router.put('/:id/favorite', authMiddleware.authUser, assetController.toggleFavorite);

/* DELETE /api/assets/:id */
router.delete('/:id', authMiddleware.authUser, assetController.deleteAsset);

/* POST /api/assets/:id/chat */
router.post('/:id/chat', authMiddleware.authUser, assetController.chatAsset);

module.exports = router;
