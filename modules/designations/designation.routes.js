const router =
  require("express").Router();

const controller =
  require("./designation.controller");


const authorize = require("../../middleware/authorize.middleware");

router.get("/", authorize("DESIGNATION_MANAGE"), controller.getAll);
router.post("/", authorize("DESIGNATION_MANAGE"), controller.create);
router.put("/:id", authorize("DESIGNATION_MANAGE"), controller.update);
router.delete("/:id", authorize("DESIGNATION_MANAGE"), controller.delete);
router.get(
  "/by-department/:departmentId",
  controller.getByDepartment
);
module.exports =
  router;