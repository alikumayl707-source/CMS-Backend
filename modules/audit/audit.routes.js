const express = require("express");

const router = express.Router();

const controller =
  require("./audit.controller");
const audit =
  require("../../middleware/audit.middleware");
const authorize =
  require("../../middleware/authorize.middleware");

router.get(
  "/logs",
  authorize("AUDIT_VIEW"),
  controller.getAuditLogs
);

router.get(
  "/logs/:id",
  authorize("AUDIT_VIEW"),
  audit("CLAIM_VIEW", "CLAIM"),
  controller.getAuditById
);

module.exports = router;