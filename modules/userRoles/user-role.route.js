const express =
  require("express");

const router =
  express.Router();
const authorize = require("../../middleware/authorize.middleware");

const controller =
  require("./user-role.controller");

router.get(
  "/",
  authorize('ORG_VIEW'),
  controller.getAll
);

module.exports =
  router;