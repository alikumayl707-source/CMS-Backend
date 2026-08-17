const express = require("express");

const router = express.Router();

const permissionController =
    require("./permission.controller");

const permissionMiddleware =
    require("../../middleware/authorize.middleware");

router.get(
    "/",
    permissionMiddleware("PERMISSION_VIEW"),
    permissionController.getAll
);

router.post(
    "/",
    permissionMiddleware("PERMISSION_CREATE"),
    permissionController.create
);

router.put(
    "/:id",
    permissionMiddleware("PERMISSION_UPDATE"),
    permissionController.update
);

router.delete(
    "/:id",
    permissionMiddleware("PERMISSION_DELETE"),
    permissionController.delete
);

module.exports = router;
