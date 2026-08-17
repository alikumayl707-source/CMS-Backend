const router =
 require("express")
  .Router();

const controller =
 require(
  "./approval-matrix.controller"
 );

router.get(
 "/",
 controller.getAll
);

router.post(
 "/",
 controller.create
);

router.post(
 "/determine-approver",
 controller.determineApprover
);

module.exports =
 router;