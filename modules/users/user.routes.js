const express = require("express");

const router = express.Router();

const userController = require("./user.controller");

const authorize = require("../../middleware/authorize.middleware");

const audit = require("../../middleware/audit.middleware");

router.get(
    "/",
    authorize("USER_VIEW"),
    audit("VIEW_USERS", "USER"),
    userController.getAll
);
router.get('/me', userController.getCurrentUser);

router.get(
    "/:id",
    authorize("USER_VIEW"),
    audit("VIEW_USER", "USER"),
    userController.getById
);

router.post(
    "/",
    authorize("USER_CREATE"),
    audit("CREATE_USER", "USER"),
    userController.create
);

router.put(
    "/:id",
    authorize("USER_UPDATE"),
    audit("UPDATE_USER", "USER"),
    userController.update
);

router.delete(
    "/:id",
    authorize("USER_DELETE"),
    audit("DELETE_USER", "USER"),
    userController.delete
);
router.post(
 "/:id/roles",
 authorize("USER_ROLE_ASSIGN"),
 userController.assignRole
);

router.delete(
 "/:id/roles/:roleId",
 authorize("USER_ROLE_ASSIGN"),
 userController.removeRole
);
module.exports = router;
