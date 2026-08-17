const express = require("express");

const router = express.Router();

const controller =
  require("./audit.controller");

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
  controller.getAuditById
);

module.exports = router;