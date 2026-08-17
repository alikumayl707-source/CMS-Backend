const express = require("express");

const router = express.Router();

const controller =
  require("./workflow.controller");

router.get(
  "/dashboard",
  controller.dashboard
);

router.get(
  "/notifications",
  controller.myNotifications
);

module.exports = router;