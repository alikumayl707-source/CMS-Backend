    const express = require("express");

    const router = express.Router();

    const roleController = require("./role.controller");

    const authorize = require("../../middleware/authorize.middleware");

    const validate = require("../../middleware/validate.middleware");

    const roleValidation =
        require("../../validations/role.validation");
    router.get(
    "/designation-roles",
    authorize("ROLE_VIEW"),
    roleController.getDesignationRoles
    );
    router.put(
        "/:id/permissions",
        authorize("ROLE_UPDATE"),
        roleController.setPermissions
    );
    router.post(
    "/:id/conditions",
    authorize("ROLE_UPDATE"),
    roleController.addCondition
    );
    router.get(
    "/dropdown",
    authorize("ROLE_VIEW"), 
    roleController.getDropdown
    );
    router.delete(
    "/:id/conditions/:conditionId",
    authorize("ROLE_UPDATE"),
    roleController.removeCondition
    );
    router.get(
        "/",
        authorize("ROLE_VIEW"),
        roleController.getAll
    );

    router.post(
        "/",
        authorize("ROLE_CREATE"),
        validate(roleValidation),
        roleController.create
    );

    router.put(
        "/:id",
        authorize("ROLE_UPDATE"),
        validate(roleValidation),
        roleController.update
    );

    router.delete(
        "/:id",
        authorize("ROLE_DELETE"),
        roleController.delete
    );

    module.exports = router;
