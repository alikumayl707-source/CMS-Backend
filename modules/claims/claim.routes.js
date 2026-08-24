const express = require("express");

const router = express.Router();
const claimRepository =
  require("./claim.repository");
const claimController =
    require("./claim.controller");
const loadClaimResource =
 require("../../middleware/load.claim.resource");
const authorize =
    require("../../middleware/authorize.middleware");

const validate =
    require("../../middleware/validate.middleware");


const audit =
    require("../../middleware/audit.middleware");

const { upload } =
    require("../../middleware/upload.middleware");

const {
    claimDraftValidation,
    claimSubmitValidation
} = require("../../validations/claim.validation");

router.put(
  "/:id/review",
  loadClaimResource,
  authorize(
    "CLAIM_REVIEW"
  ),
  audit(
    "CLAIM_REVIEW",
    "CLAIM"
  ),
  claimController.review
);

router.put(
  "/:id/approve",

  loadClaimResource,

  authorize(
    "CLAIM_APPROVE"
  ),

  audit(
    "CLAIM_APPROVE",
    "CLAIM"
  ),

  claimController.approve
);

router.get(
  "/:id/workflow",
  authorize("CLAIM_VIEW"),
  claimController.getWorkflow
);
router.put(
  "/:id/reject",
  loadClaimResource,
authorize("CLAIM_REJECT"),
  audit(
    "CLAIM_REJECT",
    "CLAIM"
  ),
  claimController.reject
);

router.get(
    "/",
    authorize("CLAIM_VIEW"),
    audit("VIEW_CLAIMS", "CLAIM"),
    claimController.getAll
);
router.put(
  "/:id/return",
  loadClaimResource,
  authorize("CLAIM_APPROVE"),
  audit(
    "CLAIM_RETURN",
    "CLAIM"
  ),
  claimController.returnForCorrection
);
router.get(
    "/my-drafts",
    authorize("CLAIM_CREATE"),
    claimController.listMyDrafts
);
router.get(
  "/:id/documents/:docId/download",
  loadClaimResource,
  authorize("CLAIM_DOCUMENT_VIEW"),
  claimController.downloadDocument
);
router.put(
 "/:id/cancel",
 loadClaimResource,
 authorize("CLAIM_CREATE"),
 audit(
   "CLAIM_CANCEL",
   "CLAIM"
 ),
 claimController.cancel
);
router.post(
    "/check-duplicate",
    authorize("CLAIM_CREATE"),
    claimController.checkDuplicate
);

router.get(
  "/my-claims",
  authorize("CLAIM_CREATE"),
  claimController.getMyClaims
);
router.get(
    "/:id",
    loadClaimResource,
    authorize("CLAIM_APPROVE"),
    audit("CLAIM_APPROVE", "CLAIM"),
    claimController.getById
);

router.post(
    "/draft",
    authorize("CLAIM_CREATE"),
    validate(claimDraftValidation),
    audit("SAVE_CLAIM_DRAFT", "CLAIM"),
    claimController.saveDraft
);
router.post(
    "/resubmit",
    authorize("CLAIM_CREATE"),
    validate(claimSubmitValidation),
    audit("RESUBMIT_CLAIM", "CLAIM"),
    claimController.resubmit
);
router.delete(
    "/:id",
    authorize("CLAIM_DELETE"),
    audit("DELETE_CLAIM_DRAFT", "CLAIM"),
    claimController.deleteDraft
);

router.post(
    "/submit",
    authorize("CLAIM_CREATE"),
    validate(claimSubmitValidation),
    audit("SUBMIT_CLAIM", "CLAIM"),
    claimController.submit
);

router.post(
    "/:id/documents",
    authorize("CLAIM_DOCUMENT_UPLOAD"),
    upload.array("files", 10),
    audit("UPLOAD_CLAIM_DOCUMENTS", "CLAIM"),
    claimController.addDocuments
);

router.get(
    "/:id/documents",
    authorize("CLAIM_DOCUMENT_VIEW"),
    claimController.getDocuments
);
router.get(
    "/draft/:id/documents/:docId",
    authorize("CLAIM_DOCUMENT_VIEW"),
    claimController.getDocumentStatus
);

router.delete(
    "/draft/:id/documents/:docId",
    authorize("CLAIM_DOCUMENT_DELETE"),
    audit("DELETE_CLAIM_DOCUMENT", "CLAIM"),
    claimController.deleteDocument
);
module.exports = router;
