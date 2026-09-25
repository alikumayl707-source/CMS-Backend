const approvalMatrixService = require("../approvalMatrix/approval-matrix.service");
const organizationService = require("../organization/organization.service");
const AppError = require("../../utils/appError");
const {
  sendApprovalEmail,
  sendClaimRejectedEmail
} = require("../../utils/email.service");
const notificationService =
 require("../workflow/notification.service");
const prisma = require("../../prisma/index");

/* ──────────────────────────────────────────────────────────────
   Line-item accounting codes (GL No. / Charge Head)

   Entered by approvers on the approval screen and stored on each
   line of formData[fieldName] as `glNo` and `chargeHead`.
   Set REQUIRE_GL_CODING=true in .env to make both mandatory on
   every approved line before a claim can be approved.
   ────────────────────────────────────────────────────────────── */

const GL_PATTERN = /^[A-Za-z0-9.\-\/]+$/;

const CODING_FIELDS = [
  { key: "glNo", label: "GL No.", maxLength: 20, pattern: GL_PATTERN },
  { key: "chargeHead", label: "Charge Head", maxLength: 60, pattern: null }
];

const REQUIRE_GL_CODING = process.env.REQUIRE_GL_CODING === "true";

/** claimApprovalHistory.comments is a Prisma String (VARCHAR(191) on MySQL). */
const HISTORY_COMMENT_MAX = 191;

class ClaimApprovalService {

  async resolveClaimDepartmentId(claim) {

    if (claim.departmentId) {
      return claim.departmentId;
    }

    if (claim.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: claim.createdBy },
        select: { departmentId: true }
      });

      if (creator?.departmentId) {
        return creator.departmentId;
      }
    }

    const deptName =
      claim.formData?.department ??
      claim.department?.name ??
      null;

    if (!deptName) {
      return null;
    }


    let dept = await prisma.department.findFirst({
      where: {
        name: deptName
      }
    });


    if (!dept) {
      const allDepts = await prisma.department.findMany({
        select: { id: true, name: true }
      });

      const match = allDepts.find(
        d => d.name?.toLowerCase() === deptName.toLowerCase()
      );

      dept = match ?? null;
    }

    if (!dept) {
      console.warn(
        `Approval routing: could not resolve department "${deptName}" for claim ${claim.id}. ` +
        `Falling back to claim-type-only matching.`
      );
      return null;
    }

    return dept.id;
  }


  async resolveClaimLocationId(claim) {

    if (claim.locationId) {
      return claim.locationId;
    }

    if (claim.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: claim.createdBy },
        select: { locationId: true }
      });

      if (creator?.locationId) {
        return creator.locationId;
      }
    }

    return null;
  }

  /* ──────────────────────────────────────────────────────────────
     Line items: decisions, rejection reasons and GL coding
     ────────────────────────────────────────────────────────────── */

  /** Trims a submitted code; empty strings become null (i.e. "cleared"). */
  normalizeCodingValue(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
  }

  /**
   * Merges the approver's line-item decisions into the claim's line items.
   *
   * lineItemDecisions = {
   *   fieldName: "expenses",
   *   decisions: { 0: "APPROVED", 1: "REJECTED", ... },
   *   comments:  { 1: "Receipt does not match", ... },
   *   coding:    { 0: { glNo: "5010-200", chargeHead: "Staff Welfare" }, ... },
   *   rows:      [ ...edited line objects... ]
   * }
   *
   * Validates everything up front and throws before anything is written, so a
   * claim never ends up half-updated. Returns the new items, the rejected ones,
   * and a human-readable list of GL coding changes for the audit trail.
   */
  buildLineItems(claim, lineItemDecisions, { enforceRequiredCoding }) {

    const fieldName = lineItemDecisions.fieldName;
    const decisions = lineItemDecisions.decisions || {};
    const lineComments = lineItemDecisions.comments || {};
    const coding = lineItemDecisions.coding || {};
    const editedRows = Array.isArray(lineItemDecisions.rows) ? lineItemDecisions.rows : null;

    const codingChanges = [];

    const updatedItems = claim.formData[fieldName].map((item, idx) => {

      const edited = editedRows?.[idx] ?? {};
      const status = decisions[idx] ?? item.lineStatus ?? "APPROVED";
      const isRejected = status === "REJECTED";

      const next = {
        ...item,
        ...edited,
        lineStatus: status,
        lineRejectionComment: isRejected
          ? (String(lineComments[idx] ?? "").trim() || null)
          : null
      };

      const lineChanges = [];

      for (const field of CODING_FIELDS) {

        // Prefer the explicit `coding` map; fall back to the edited row;
        // if neither was sent, keep whatever the line already had.
        // Rejected lines aren't paid, so their codes can't be changed.
        const submitted = coding[idx]?.[field.key] ?? edited[field.key];
        const value = (isRejected || submitted === undefined)
          ? (item[field.key] ?? null)
          : this.normalizeCodingValue(submitted);

        if (!isRejected) {
          if (value && value.length > field.maxLength) {
            throw new AppError(
              `Line ${idx + 1}: ${field.label} cannot be longer than ${field.maxLength} characters`,
              400
            );
          }
          if (value && field.pattern && !field.pattern.test(value)) {
            throw new AppError(
              `Line ${idx + 1}: ${field.label} can only contain letters, numbers, "-", "." and "/"`,
              400
            );
          }
          if (enforceRequiredCoding && REQUIRE_GL_CODING && !value) {
            throw new AppError(`Line ${idx + 1} needs a ${field.label}`, 400);
          }
        }

        next[field.key] = value;

        const before = item[field.key] ?? null;
        if (before !== value) {
          lineChanges.push(`${field.label} ${before ?? "—"} → ${value ?? "—"}`);
        }
      }

      if (lineChanges.length) {
        codingChanges.push(`Line ${idx + 1}: ${lineChanges.join("; ")}`);
      }

      return next;
    });

    const rejectedItems = updatedItems.filter(item => item.lineStatus === "REJECTED");

    if (rejectedItems.some(item => !item.lineRejectionComment)) {
      throw new AppError("A rejection comment is required for every rejected line item", 400);
    }

    return { fieldName, updatedItems, rejectedItems, codingChanges };
  }

 async recordCodingChanges(tx, claimApprovalId, actorId, codingChanges) {
    for (const change of codingChanges) {
      await tx.claimApprovalHistory.create({
        data: {
          claimApprovalId,
          actorId,
          action: "CODING_UPDATED",
          comments: this.clampComment(change)
        }
      });
    }
  }

 async commitRejection(tx, { claim, actor, currentStep, comments, built }) {

    if (built) {
      await tx.claim.update({
        where: { id: claim.id },
        data: {
          formData: { ...claim.formData, [built.fieldName]: built.updatedItems }
        }
      });

      await this.recordCodingChanges(tx, currentStep.id, actor.id, built.codingChanges);
    }
  const { count } = await tx.claimApproval.updateMany({
      where: { id: currentStep.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        approverId: currentStep.approverId ?? actor.id,
        actionedAt: new Date(),
        comments
      }
    });

    if (count === 0) {
      throw new AppError("This step has already been actioned. Refresh and try again.", 409);
    }

    await tx.claimApproval.updateMany({
      where: {
        claimId: claim.id,
        status: "PENDING",
        sequence: { gt: currentStep.sequence }
      },
      data: { status: "SKIPPED" }
    });

    await tx.claimApprovalHistory.create({
      data: {
        claimApprovalId: currentStep.id,
        actorId: actor.id,
        action: "REJECTED",
        comments
      }
    });

    return tx.claim.update({
      where: { id: claim.id },
      data: {
        status: "REJECTED",
        rejectedBy: actor.id,
        rejectionComments: comments,
        currentApprovalSequence: null,
        assignedApproverId: null,
        systemStage: null
      },
      include: { claimType: true, creator: true }
    });
  }

  async sendRejectionEmail(updatedClaim, comments, rejectedItems) {
    if (!updatedClaim.creator?.email) {
      console.warn(`Claim ${updatedClaim.id} creator has no email — rejection email not sent.`);
      return;
    }

    try {
      await sendClaimRejectedEmail({
        to: updatedClaim.creator.email,
        employeeName: updatedClaim.creator.name,
        claimNumber: updatedClaim.claimNumber,
        claimType: updatedClaim.claimType?.name ?? updatedClaim.claimType?.code,
        amount: updatedClaim.amount,
        rejectionComments: comments,
        rejectedItems,
        claimId: updatedClaim.id
      });
    } catch (err) {
      console.error(`Claim rejection email FAILED for claim ${updatedClaim.id}:`, err);
    }
  }

async notifyApprover(
  approver,
  claim,
  claimWithDocuments
) {
const vendorWorkflowClaimTypes =
  (process.env.VENDOR_WORKFLOW_CLAIM_TYPES || '')
    .split(',')
    .map(x => x.trim().toUpperCase())
    .filter(Boolean);
  const claimTypeCode =
    claimWithDocuments?.claimType?.code?.toUpperCase();

  const approvalMatrixId =
    claimWithDocuments?.approvalMatrixId ??
    claim.approvalMatrixId ??
    null;

const isVendorWorkflow =
  vendorWorkflowClaimTypes.includes(
    claimTypeCode?.toUpperCase()
  );

  if (isVendorWorkflow) {

    const matrix = approvalMatrixId
      ? await prisma.approvalMatrix.findUnique({
          where: {
            id: approvalMatrixId
          },
          select: {
            id: true,
            vendorEmail: true
          }
        })
      : null;

    if (!matrix?.vendorEmail) {

      console.error(
        `Approval routing: vendor email not configured for claim ${claim.id}. ` +
        `ClaimType=${claimTypeCode}, MatrixId=${approvalMatrixId ?? 'NULL'}`
      );

      return;
    }

    try {

      await sendApprovalEmail({
        to: matrix.vendorEmail,
        approverName: 'Vendor',
        claimantName:
          claimWithDocuments.creator?.name,
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        claimType:
          claimWithDocuments.claimType?.name,
        amount:
          claimWithDocuments.amount,
        documents:
          claimWithDocuments.documents || []
      });

      console.log(
        `Vendor email sent successfully for claim ${claim.id} to ${matrix.vendorEmail}`
      );

    } catch (err) {

      console.error(
        `Approval routing: vendor email FAILED for claim ${claim.id}:`,
        err
      );

    }

    return;
  }

  if (!approver) {

    console.warn(
      `Approval routing: no approver resolved for claim ${claim.id}. Nobody notified.`
    );

    return;
  }

  if (!approver.email) {

    console.warn(
      `Approval routing: approver ${approver.id} (${approver.name}) has no email configured. ` +
      `Claim ${claim.id} assigned but email not sent.`
    );

    return;
  }

  try {

    await sendApprovalEmail({
      to: approver.email,
      approverName: approver.name,
      claimantName:
        claimWithDocuments.creator?.name,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      claimType:
        claimWithDocuments.claimType?.name,
      amount:
        claimWithDocuments.amount,
      documents:
        claimWithDocuments.documents || []
    });

  } catch (err) {

    console.error(
      `Approval routing: sendApprovalEmail FAILED for approver ${approver.id} on claim ${claim.id}:`,
      err
    );

  }
}

async initializeChain(claim, creatorId, resolvedMatrix = null) {
  const vendorWorkflowClaimTypes =
    (process.env.VENDOR_WORKFLOW_CLAIM_TYPES || '')
      .split(',')
      .map(x => x.trim().toUpperCase())
      .filter(Boolean);

  const creator = await prisma.user.findUnique({
    where: { id: creatorId }
  });

  if (!creator) {
    throw new AppError("Claim creator not found", 404);
  }

  const claimType = await prisma.claimType.findUnique({
    where: { id: claim.claimTypeId }
  });

  if (!claimType) {
    throw new AppError("Claim type not found", 404);
  }

  const isVendorWorkflow = vendorWorkflowClaimTypes.includes(
    claimType.code?.toUpperCase()
  );

  if (isVendorWorkflow) {

    const claimDepartmentId = await this.resolveClaimDepartmentId(claim);

    const matrix = resolvedMatrix ?? await approvalMatrixService.determineWorkflow({
      claimType: claimType.code,
      departmentId: claimDepartmentId,
      amount: Number(claim.amount),
      ...(claim.formData || {})
    });

    if (!matrix) {
      throw new AppError("No workflow found", 422);
    }

    claim = await prisma.claim.update({
      where: { id: claim.id },
      data: {
        approvalMatrixId: matrix.id,
        status: 'PENDING_APPROVAL',
        currentApprovalSequence: null,
        assignedApproverId: null,
        requiredApproverRole: null,
        systemStage: null
      }
    });

    const claimWithDocuments = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: { documents: true, claimType: true, creator: true }
    });

    await this.notifyApprover(null, claim, claimWithDocuments);

    return { claim };
  }

  if (claimType.bypassApprovalChain) {

    const hrApprover = await this.findSystemDeptHead(true);

    if (!hrApprover) {
      throw new AppError("HR approver not configured", 500);
    }

    await prisma.claim.update({
      where: { id: claim.id },
      data: {
        status: "PENDING_APPROVAL",
        systemStage: "HR",
        currentApprovalSequence: null,
        assignedApproverId: hrApprover.id,
        requiredApproverRole: "HR"
      }
    });

    await notificationService.notifyUser(
      hrApprover.id,
      "HR Approval Required",
      `Claim ${claim.claimNumber || claim.id} requires HR approval`
    );

    const claimWithDocs = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: { documents: true, claimType: true, creator: true }
    });

    await this.notifyApprover(hrApprover, claim, claimWithDocs);

    return;
  }

  const claimDepartmentId = await this.resolveClaimDepartmentId(claim);
  const claimLocationId = await this.resolveClaimLocationId(claim);

  const matrix = resolvedMatrix ?? await approvalMatrixService.determineWorkflow({
    claimType: claimType.code,
    departmentId: claimDepartmentId,
    amount: Number(claim.amount),
    ...(claim.formData || {})
  });

  if (!matrix) {
    throw new AppError("No workflow found", 422);
  }

  if (!matrix?.approvers?.length) {
    throw new AppError("No workflow found", 422);
  }

  claim = await prisma.claim.update({
    where: { id: claim.id },
    data: { approvalMatrixId: matrix.id }
  });

  const existingChain = await prisma.claimApproval.findMany({
    where: { claimId: claim.id }
  });

  const hasActiveStep = existingChain.some(step => step.status === "PENDING");

  if (hasActiveStep) {
    throw new AppError("Approval chain already exists for this claim", 400);
  }


  const allApprovers = matrix.approvers;

  const hasScopedApprovers = allApprovers.some(
    a => a.locationId != null || a.departmentId != null
  );

  let scopedApprovers = allApprovers;

  if (hasScopedApprovers) {
    scopedApprovers = allApprovers.filter(a => {
      const locationOk = a.locationId == null || a.locationId === claimLocationId;
      const departmentOk = a.departmentId == null || a.departmentId === claimDepartmentId;
      return locationOk && departmentOk;
    });

    if (!scopedApprovers.length) {
      throw new AppError(
        `No approval chain is configured for this claim's location/department combination ` +
        `(claim type ${claimType.code}). Ask an administrator to add this combination to the Approval Matrix rule.`,
        422
      );
    }
  }

  const approvers = [...scopedApprovers].sort((a, b) => a.sequence - b.sequence);

  const firstSteps = approvers.filter(x => x.sequence === 1);
  const firstStep = firstSteps[0];

  if (!firstStep) {
    throw new AppError("Workflow start step not found", 422);
  }

  let walkStartUserId = claim.createdBy;

  const approvalRows = [];
  const resolvedApproverIds = {};

  for (const step of approvers) {

    let resolvedApproverId = step.specificUserId ?? null;

    if (!resolvedApproverId && step.role) {

      const eligible = await organizationService.findEligibleApprover(
        walkStartUserId,
        step.role.name,
        Number(claim.amount)
      );

      resolvedApproverId = eligible?.id ?? null;

      if (resolvedApproverId) {
        walkStartUserId = resolvedApproverId;
      }

    } else if (resolvedApproverId) {
      walkStartUserId = resolvedApproverId;
    }

    resolvedApproverIds[step.sequence] = resolvedApproverId;

    approvalRows.push({
      claimId: claim.id,
      sequence: step.sequence,
      roleId: step.roleId,
      approverId: resolvedApproverId,
      isParallel: step.isParallel ?? false,
      groupKey: step.groupKey ?? null,
      status: "PENDING"
    });
  }

  const firstAssignedApproverId = resolvedApproverIds[1] ?? null;

  if (firstSteps.length === 1 && !firstAssignedApproverId) {
    throw new AppError("Unable to resolve first approver", 422);
  }

  let requiredRole = firstStep.role?.name ?? null;

  if (!requiredRole && firstAssignedApproverId) {
    const approver = await prisma.user.findUnique({
      where: { id: firstAssignedApproverId },
      include: { designation: true }
    });

    requiredRole =
      approver?.designation?.name ??
      approver?.name ??
      "APPROVER";
  }

  const updatedClaim = await prisma.$transaction(async (tx) => {

    for (const row of approvalRows) {
      await tx.claimApproval.upsert({
        where: {
          claimId_sequence: {
            claimId: row.claimId,
            sequence: row.sequence
          }
        },
        update: {
          roleId: row.roleId,
          approverId: row.approverId,
          isParallel: row.isParallel,
          groupKey: row.groupKey,
          status: "PENDING",
          actionedAt: null,
          comments: null,
          escalatedAt: null,
          dueAt: null,
          reminderSentAt: null
        },
        create: row
      });
    }

    return tx.claim.update({
      where: { id: claim.id },
      data: {
        status: "PENDING_APPROVAL",
        currentApprovalSequence: 1,
        assignedApproverId: firstSteps.length === 1 ? firstAssignedApproverId : null,
        requiredApproverRole: requiredRole
      }
    });
  });

  for (const step of firstSteps) {

    const recipientId = resolvedApproverIds[step.sequence];
    if (!recipientId) continue;

    await notificationService.notifyUser(
      recipientId,
      "Claim Approval Required",
      `Claim ${claim.claimNumber || claim.id} requires your approval`
    );

    const approver = await prisma.user.findUnique({ where: { id: recipientId } });

    const claimWithDocuments = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: { documents: true, claimType: true, creator: true }
    });

    await this.notifyApprover(approver, claim, claimWithDocuments);
  }

  return {
    claim: updatedClaim,
    currentApprovalSequence: 1,
    assignedApproverId: firstAssignedApproverId
  };
}
async advance(claim, actor, comments, lineItemDecisions) {

  if (
    claim.status !== "PENDING_APPROVAL" &&
    claim.status !== "PARTIALLY_APPROVED"
  ) {
    throw new AppError("Claim is not awaiting approval", 400);
  }

  this.validateSoD(claim, actor);

  const matrix = claim.approvalMatrixId
    ? await prisma.approvalMatrix.findUnique({ where: { id: claim.approvalMatrixId } })
    : await prisma.approvalMatrix.findFirst({ where: { claimType: claim.claimType?.code } });

  const approvalComment = this.clampComment(comments);

  if (matrix?.approvalCommentRequired && !approvalComment) {
    throw new AppError("Approval comments required", 400);
  }

  const actorRoleIds = (actor.userRoles ?? []).map(
    role => role.roleId ?? role.role?.id
  );

  const currentStep = await prisma.claimApproval.findFirst({
    where: {
      claimId: claim.id,
      sequence: claim.currentApprovalSequence,
      status: "PENDING",
      OR: [
        { approverId: actor.id },
        { roleId: { in: actorRoleIds } }
      ]
    },
    include: { role: true }
  });

  if (!currentStep) {
    throw new AppError(
      `No approval step found for user ${actor.id} on claim ${claim.id}. Sequence: ${claim.currentApprovalSequence}`,
      403
    );
  }

  if (currentStep.roleId) {
    await this.validateDepartmentalHead(claim, actor);
  }

  this.validateActorCanActOnStep(currentStep, actor, Number(claim.amount));

  // Validate everything up front. Throws before anything is written.
  const built = this.hasLineItems(claim, lineItemDecisions)
    ? this.buildLineItems(claim, lineItemDecisions, { enforceRequiredCoding: true })
    : null;

  // Even a single rejected line item rejects the whole claim.
  if (built?.rejectedItems.length) {
    return this.rejectDueToLineItems(claim, actor, currentStep, built);
  }

  const effectiveAmount = built
    ? built.updatedItems.reduce(
        (sum, item) => item.lineStatus === "REJECTED" ? sum : sum + (Number(item.amount) || 0),
        0
      )
    : Number(claim.amount);

  const result = await prisma.$transaction(async (tx) => {

    if (built) {
      await tx.claim.update({
        where: { id: claim.id },
        data: {
          formData: { ...claim.formData, [built.fieldName]: built.updatedItems },
          amount: effectiveAmount
        }
      });

      await this.recordCodingChanges(tx, currentStep.id, actor.id, built.codingChanges);
    }

    const { count } = await tx.claimApproval.updateMany({
      where: { id: currentStep.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        actionedAt: new Date(),
        comments: approvalComment,
        approverId: currentStep.approverId ?? actor.id
      }
    });

    if (count === 0) {
      throw new AppError("This step has already been actioned. Refresh and try again.", 409);
    }

    await tx.claimApprovalHistory.create({
      data: {
        claimApprovalId: currentStep.id,
        actorId: actor.id,
        action: "APPROVED",
        comments: approvalComment
      }
    });

    if (currentStep.isParallel && currentStep.groupKey) {

      const remaining = await tx.claimApproval.count({
        where: {
          claimId: claim.id,
          sequence: currentStep.sequence,
          groupKey: currentStep.groupKey,
          status: { not: "APPROVED" }
        }
      });

      if (remaining > 0) {
        const updatedClaim = await tx.claim.update({
          where: { id: claim.id },
          data: { status: "PARTIALLY_APPROVED" }
        });
        return { updatedClaim, notifyInfo: null };
      }
    }

    const nextStep = await tx.claimApproval.findFirst({
      where: {
        claimId: claim.id,
        sequence: { gt: currentStep.sequence }
      },
      orderBy: { sequence: "asc" },
      include: { role: true }
    });

    if (nextStep) {

      let eligibleId = nextStep.approverId ?? null;

      if (!eligibleId && nextStep.role) {
        const walkStartUserId = currentStep.approverId ?? actor.id;
        const eligible = await organizationService.findEligibleApprover(
          walkStartUserId,
          nextStep.role.name,
          effectiveAmount
        );
        eligibleId = eligible?.id ?? null;
      }

      if (!eligibleId) {
        // Throwing here rolls back the line items too, so the approver can retry cleanly.
        throw new AppError(
          `Unable to resolve approver for next step (sequence ${nextStep.sequence}) on claim ${claim.id}`,
          422
        );
      }

      if (!nextStep.approverId) {
        await tx.claimApproval.update({
          where: { id: nextStep.id },
          data: { approverId: eligibleId }
        });
      }

      let nextRequiredRole = nextStep.role?.name ?? null;

      if (!nextRequiredRole) {
        const nextApprover = await tx.user.findUnique({
          where: { id: eligibleId },
          include: { designation: true }
        });

        nextRequiredRole =
          nextApprover?.designation?.name ??
          nextApprover?.name ??
          "APPROVER";
      }

      const updatedClaim = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: "PARTIALLY_APPROVED",
          currentApprovalSequence: nextStep.sequence,
          assignedApproverId: eligibleId,
          requiredApproverRole: nextRequiredRole
        }
      });

      return { updatedClaim, notifyInfo: { type: "next", eligibleId } };
    }

    const updatedClaim = await tx.claim.update({
      where: { id: claim.id },
      data: {
        status: "APPROVED",
        approvedBy: actor.id,
        currentApprovalSequence: null,
        assignedApproverId: null,
        requiredApproverRole: null,
        systemStage: "DONE"
      }
    });

    return { updatedClaim, notifyInfo: null };
  }, { timeout: 15000 });

  if (result.notifyInfo?.type === "next") {

    const eligibleId = result.notifyInfo.eligibleId;

    await notificationService.notifyUser(
      eligibleId,
      "Claim Approval Required",
      `Claim ${claim.claimNumber || claim.id} requires your approval`
    );

    const approver = await prisma.user.findUnique({ where: { id: eligibleId } });

    const claimWithDocuments = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: { documents: true, claimType: true, creator: true }
    });

    await this.notifyApprover(approver, claim, claimWithDocuments);
  }

  return result.updatedClaim;
}


async rejectDueToLineItems(claim, actor, currentStep, built) {

  // Number by the line's real position, not its position among rejected lines.
  const rejectedSummary = built.updatedItems
    .map((item, idx) =>
      item.lineStatus === "REJECTED"
        ? `Line ${idx + 1}: ${item.lineRejectionComment || "No reason provided"}`
        : null
    )
    .filter(Boolean)
    .join(" | ");

  const finalComments = this.clampComment(`Rejected line item(s): ${rejectedSummary}`);

  const updatedClaim = await prisma.$transaction(
    tx => this.commitRejection(tx, { claim, actor, currentStep, comments: finalComments, built }),
    { timeout: 15000 }
  );

  await this.sendRejectionEmail(updatedClaim, finalComments, built.rejectedItems);

  return updatedClaim;
}


async cancel(claim, actor) {

  if (claim.createdBy !== actor.id) {
    throw new AppError("Only creator can cancel", 403);
  }

  if (claim.status === "APPROVED") {
    throw new AppError("Cannot cancel approved claim", 400);
  }

  return prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "CANCELLED",
      currentApprovalSequence: null,
      assignedApproverId: null
    }
  });
}

async areParallelStepsCompleted(claimId, sequence, groupKey) {
  const pending = await prisma.claimApproval.count({
    where: {
      claimId,
      sequence,
      groupKey,
      status: { not: "APPROVED" }
    }
  });

  return pending === 0;
}

async advanceToFinance(claim, actor) {

  const financeApprover = await this.findSystemDeptHead(false);

  if (!financeApprover) {
    throw new AppError(
      "Finance approver not configured — claim cannot advance to Finance stage",
      500
    );
  }

  await notificationService.notifyUser(
    financeApprover.id,
    "Finance Approval Required",
    `Claim ${claim.claimNumber || claim.id} requires Finance approval`
  );

  const claimWithDocuments = await prisma.claim.findUnique({
    where: { id: claim.id },
    include: { documents: true, claimType: true, creator: true }
  });


  await this.notifyApprover(financeApprover, claim, claimWithDocuments);

return prisma.claim.update({
  where: { id: claim.id },
  data: {
    systemStage: "FINANCE",
    assignedApproverId: financeApprover?.id ?? null,
    reminderSentAt: null,
    escalatedAt: null,
    claimantNotifiedAt: null
  }
});
}

async finalizeClaim(claim, actor) {

  return prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "APPROVED",
      approvedBy: actor.id,
      assignedApproverId: null,
      currentApprovalSequence: null,
      systemStage: "DONE"
    }
  });
}
  clampComment(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, COMMENT_MAX) : null;
  }

  hasLineItems(claim, lineItemDecisions) {
    return Boolean(
      lineItemDecisions?.fieldName &&
      Array.isArray(claim.formData?.[lineItemDecisions.fieldName])
    );
  }
async reject(claim, actor, comments, lineItemDecisions) {

  if (claim.status !== "PENDING_APPROVAL" && claim.status !== "PARTIALLY_APPROVED") {
    throw new AppError("Claim is not awaiting approval", 400);
  }

  if (claim.currentApprovalSequence == null) {
    throw new AppError("This claim has no active approval step", 400);
  }

  this.validateSoD(claim, actor);

  const matrix = claim.approvalMatrixId
    ? await prisma.approvalMatrix.findUnique({ where: { id: claim.approvalMatrixId } })
    : await prisma.approvalMatrix.findFirst({ where: { claimType: claim.claimType?.code } });

  const rejectionComment = this.clampComment(comments);

  if (matrix?.rejectionCommentRequired && !rejectionComment) {
    throw new AppError("Rejection comments required", 400);
  }

  await this.validateDepartmentalHead(claim, actor);

  const currentStep = await prisma.claimApproval.findUnique({
    where: { claimId_sequence: { claimId: claim.id, sequence: claim.currentApprovalSequence } }
  });

  if (!currentStep) {
    throw new AppError(`No approval chain found for claim ${claim.id} at sequence ${claim.currentApprovalSequence}`, 500);
  }

  if (currentStep.status !== "PENDING") {
    throw new AppError("This step has already been actioned. Refresh and try again.", 409);
  }

  this.validateActorCanActOnStep(currentStep, actor, claim.amount);

  // Validate everything up front. Throws before anything is written.
  const built = this.hasLineItems(claim, lineItemDecisions)
    ? this.buildLineItems(claim, lineItemDecisions, { enforceRequiredCoding: false })
    : null;

  const updatedClaim = await prisma.$transaction(
    tx => this.commitRejection(tx, { claim, actor, currentStep, comments: rejectionComment, built }),
    { timeout: 15000 }
  );

  await this.sendRejectionEmail(updatedClaim, rejectionComment, built?.rejectedItems ?? []);

  return updatedClaim;
}



  validateSoD(claim, actor) {
    if (claim.createdBy === actor.id) {
      throw new AppError("Creator cannot approve/reject their own claim", 403);
    }
    if (claim.reviewedBy === actor.id) {
      throw new AppError("Reviewer cannot approve/reject the same claim", 403);
    }
  }

async returnForCorrection(claim, actor, comments) {

  if (!comments || !comments.trim()) {
    throw new AppError("Return comments are mandatory", 400);
  }

  if (claim.status !== "PENDING_APPROVAL") {
    throw new AppError("Claim is not awaiting approval", 400);
  }

  return prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "RETURNED",
      currentApprovalSequence: null,
      assignedApproverId: null,
      rejectionComments: comments || null
    }
  });
}

validateActorCanActOnStep(step, actor, claimAmount) {
  if (step.approverId) {
    if (Number(step.approverId) !== Number(actor.id)) {
      throw new AppError("This step is assigned to a different approver", 403);
    }
  } else {
    const actorRoleIds = (actor.userRoles ?? []).map(ur => ur.roleId ?? ur.role?.id);
    if (step.roleId && !actorRoleIds.includes(step.roleId)) {
      throw new AppError("Your role does not match the required approver role for this step", 403);
    }
  }

  // // FIX: was commented out — approvers could approve amounts beyond
  // // their limit, especially after lineItemDecisions changes the amount.
  // const effectiveLimit = Number(
  //   actor.approvalLimit ??
  //   actor.designation?.defaultApprovalLimit ??
  //   0
  // );

  // if (Number(claimAmount) > effectiveLimit) {
  //   throw new AppError(`Claim amount exceeds your approval limit (${effectiveLimit})`, 403);
  // }
}

async validateActorIsSystemDeptHead(claim, actor, isHR) {

  const dept = await prisma.department.findFirst({
    where: isHR ? { isHRDept: true } : { isFinanceDept: true }
  });

  if (!dept) {
    throw new AppError("Department configuration missing", 500);
  }

  if (Number(actor.departmentId) !== Number(dept.id)) {
    throw new AppError(
      `Only ${isHR ? "HR" : "Finance"} department can approve this stage`,
      403
    );
  }

  if (Number(claim.assignedApproverId) !== Number(actor.id)) {
    throw new AppError("Claim is assigned to another approver", 403);
  }
}

async findSystemDeptHead(isHR) {

  const dept = await prisma.department.findFirst({
    where: isHR ? { isHRDept: true } : { isFinanceDept: true }
  });

  if (!dept) {
    return null;
  }

  const departmentHead = await prisma.user.findFirst({
    where: {
      departmentId: dept.id,
      isDepartmentHead: true,
      orgSyncedAt: { not: null }
    },
    include: { designation: true, department: true }
  });

  if (departmentHead) {
    return departmentHead;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: {
      departmentId: dept.id,
      orgSyncedAt: { not: null }
    },
    orderBy: { id: "asc" },
    include: { designation: true, department: true }
  });

  return fallbackUser || null;
}

  async validateDepartmentalHead(claim, actor) {
    if (claim.systemStage) return;

    const creator = await prisma.user.findUnique({ where: { id: claim.createdBy } });
    if (!creator) throw new AppError("Claim creator not found", 500);

    const isInChain = await this.isInReportingChain(creator.id, actor.id);
    if (!isInChain && Number(actor.departmentId) !== Number(creator.departmentId)) {
      throw new AppError(
        "You can only act on requests from your own department's subordinates",
        403
      );
    }
  }

  async isInReportingChain(startUserId, targetManagerId, maxDepth = 15) {
    let currentId = startUserId;
    for (let i = 0; i < maxDepth; i++) {
      const current = await prisma.user.findUnique({
        where: { id: currentId },
        select: { reportsToId: true },
      });
      if (!current || !current.reportsToId) return false;
      if (current.reportsToId === targetManagerId) return true;
      currentId = current.reportsToId;
    }
    return false;
  }
}

module.exports = new ClaimApprovalService();
