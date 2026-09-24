const express = require("express");
const router = express.Router();

const controller = require("../claimWorkFlow/workflow-dashboard.controller");
const authorize = require("../../middleware/authorize.middleware");

router.get(
  "/dashboard",
  authorize('ORG_VIEW'),
  controller.getDashboard
);
router.get(
  "/claims/:id/workflow",
  authorize('ORG_VIEW'),
  controller.getClaimWorkflow
);
router.get(
  "/:id",
  authorize('ORG_VIEW'),
  controller.getWorkflowById
);

router.get(
  "/:id/claims",
  authorize('ORG_VIEW'),
  controller.getWorkflowClaims
);

module.exports = router;