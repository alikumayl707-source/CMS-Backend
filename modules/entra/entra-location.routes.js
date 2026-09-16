const express = require("express");
const router = express.Router();
const controller = require("./entra-location.controller");
const authorize = require("../../middleware/authorize.middleware");

router.post("/sync-location", authorize('ORG_VIEW'), controller.syncLocation);

module.exports = router;