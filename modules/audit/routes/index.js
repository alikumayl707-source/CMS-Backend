const express = require("express");

const router = express.Router();

router.use(
    "/auth",
    require("./auth.route")
);

router.use(
    "/users",
    require("./user.route")
);

router.use(
    "/roles",
    require("./role.route")
);

router.use(
    "/permissions",
    require("./permission.route")
);

router.use(
    "/overrides",
    require("./override.route")
);

router.use(
    "/access",
    require("./access.route")
);

router.use(
    "/audit",
    require("./audit.route")
);

module.exports = router;