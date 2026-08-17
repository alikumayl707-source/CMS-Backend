const express = require("express");
const router = express.Router();

const controller = require("../claimWorkFlow/workflow-dashboard.controller");
const authorize = require("../../middleware/authorize.middleware");

router.get(
  "/dashboard",
  authorize('VIEW_DASHBOARD'),
  controller.getDashboard
);

// router.get(
//   "/:id",

//   controller.getWorkflowById
// );

// router.get(
//   "/:id/claims",
//   controller.getWorkflowClaims
// );

module.exports = router;