const router =
  require("express").Router();

const controller =
  require("./department.controller");


const authorize = require("../../middleware/authorize.middleware");

router.get("/", authorize("DEPARTMENT_MANAGE"), controller.getAll);
router.post("/", authorize("DEPARTMENT_MANAGE"), controller.create);
router.put("/:id", authorize("DEPARTMENT_MANAGE"), controller.update);
router.delete("/:id", authorize("DEPARTMENT_MANAGE"), controller.delete);

module.exports = router;
