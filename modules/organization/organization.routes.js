const express = require("express");
const router = express.Router();
const organizationController = require("./organization.controller");
const authorize = require("../../middleware/authorize.middleware");

router.get('/', authorize("ORG_VIEW"), organizationController.getHierarchy);
router.get('/tree', authorize("ORG_VIEW"), organizationController.getFullHierarchy);
router.get('/department/:departmentId', authorize("ORG_VIEW"), organizationController.getByDepartment);
router.post('/sync-full', authorize("ORG_UPDATE"), organizationController.syncFullOrg);
router.put('/:id/manager', authorize("ORG_UPDATE"), organizationController.assignManager);
router.put('/:id/department', authorize("ORG_UPDATE"), organizationController.assignDepartment);
router.put('/:id/designations', authorize("ORG_UPDATE"), organizationController.assignDesignation);
router.put('/:id/approval-limit', authorize("ORG_UPDATE"), organizationController.updateApprovalLimit);

module.exports = router;