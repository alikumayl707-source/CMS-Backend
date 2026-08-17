const express =
  require("express");

const router =
  express.Router();

const controller =
  require("./user-role.controller");

router.get(
  "/",
  controller.getAll
);

module.exports =
  router;