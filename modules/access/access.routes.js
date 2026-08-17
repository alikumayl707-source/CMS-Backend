const express = require("express");

const router = express.Router();

const accessController =
    require("./access.controller");

router.post(
    "/check",
    accessController.check
    
);

module.exports = router;
