const express = require('express');
const authMiddleware = require("../middlewares/auth.middleware");
const shareController = require("../controllers/share.controller");

const router = express.Router();

/* GET /api/shares/shared-with-me */
router.get('/shared-with-me', authMiddleware.authUser, shareController.getSharedWithMe);

/* POST /api/shares/:id/share */
router.post('/:id/share', authMiddleware.authUser, shareController.shareAsset);

/* PUT /api/shares/:id/link-access */
router.put('/:id/link-access', authMiddleware.authUser, shareController.updateLinkAccess);

module.exports = router;
