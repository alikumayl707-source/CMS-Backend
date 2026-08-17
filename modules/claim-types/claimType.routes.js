    const express = require("express");

    const router = express.Router();

    const claimTypeController =
        require("./claimType.controller");

    const authorize =
        require("../../middleware/authorize.middleware");

    const validate =
        require("../../middleware/validate.middleware");

    const claimTypeValidation =
        require("../../validations/claimType.validation");

    router.get(
        "/",
        authorize("CLAIM_TYPE_VIEW"),
        claimTypeController.getAll
    );


    router.get(
        "/code/:code",
        authorize("CLAIM_TYPE_VIEW"),
        claimTypeController.getByCode
    );

    router.get(
        "/:id",
        authorize("CLAIM_TYPE_VIEW"),
        claimTypeController.getById
    );

    router.post(
        "/",
        authorize("CLAIM_TYPE_CREATE"),
        validate(claimTypeValidation),
        claimTypeController.create
    );

    router.put(
        "/:id",
        authorize("CLAIM_TYPE_UPDATE"),
        validate(claimTypeValidation),
        claimTypeController.update
    );

    router.delete(
        "/:id",
        authorize("CLAIM_TYPE_DELETE"),
        claimTypeController.delete
    );

    module.exports = router;
