const router =
 require("express")
  .Router();
const authorize = require("../../middleware/authorize.middleware");
const controller =
 require(
  "./approval-matrix.controller"
 );

router.get(
 "/",
 authorize('ORG_VIEW'),
 controller.getAll
);

router.post(
 "/",
 authorize('ORG_VIEW'),
 controller.create
);

router.post(
 "/determine-approver",
 authorize('ORG_VIEW'),
 controller.determineApprover
);

module.exports =
 router;