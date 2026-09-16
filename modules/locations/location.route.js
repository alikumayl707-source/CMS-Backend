
const router = require("express").Router();
const controller = require("./location.controller");
const authorize = require("../../middleware/authorize.middleware");

router.get("/", authorize("CLAIM_VIEW"), controller.getAll);
router.post("/", authorize("DEPARTMENT_MANAGE"), controller.create);
router.get("/:id/users", authorize("CLAIM_VIEW"), controller.getUsers);
router.get("/:id/departments", authorize("CLAIM_VIEW"), controller.getDepartments);
module.exports = router;
