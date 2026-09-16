/*
  Mount this router in your main app/routes aggregator, e.g.:
    app.use("/api/settings/escalation", require("./modules/workflow/escalation-settings.routes"));
*/

const router = require("express").Router();
const controller = require("./escalation-settings.controller");
const authorize = require("../../middleware/authorize.middleware");
const audit = require("../../middleware/audit.middleware");

router.get(
  "/",
  authorize("SETTINGS_VIEW"),
  controller.get
);

router.get(
  "/users",
  authorize("SETTINGS_VIEW"),
  controller.getUsers
);

router.put(
  "/",
  authorize("SETTINGS_MANAGE"),
  audit("UPDATE_ESCALATION_SETTINGS", "SETTINGS"),
  controller.update
);

module.exports = router;
