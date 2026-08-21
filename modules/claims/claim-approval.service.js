const { PrismaClient } = require("@prisma/client");
const approvalMatrixService = require("../approvalMatrix/approval-matrix.service");
const organizationService = require("../organization/organization.service");
const AppError = require("../../utils/appError");
const {
  sendApprovalEmail
} = require("../../utils/email.service");
const notificationService =
 require("../workflow/notification.service");
const historyService =
 require("../workflow/claim-history.service");
const prisma = require("../../prisma/index"); 

class ClaimApprovalService {
async resolveClaimDepartmentId(claim) {

    if (claim.departmentId) {
      return claim.departmentId;
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

  async notifyApprover(approver, claim, claimWithDocuments) {

    if (!approver) {
      console.warn(
        `Approval routing: no approver resolved for claim ${claim.id}. Nobody notified.`
      );
      return;
    }

    if (!approver.email) {
      console.warn(
        `Approval routing: approver ${approver.id} (${approver.name}) has no email on file. ` +
        `Claim ${claim.id} is now assigned to them but NO EMAIL WAS SENT.`
      );
      return;
    }

    try {
      await sendApprovalEmail({
        to: approver.email,
        approverName: approver.name,
        claimantName: claimWithDocuments.creator?.name,
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        claimType: claimWithDocuments.claimType?.name,
        amount: claimWithDocuments.amount,
        documents: claimWithDocuments.documents || []
      });
    } catch (err) {
      console.error(
        `Approval routing: sendApprovalEmail FAILED for approver ${approver.id} on claim ${claim.id}:`,
        err
      );
    }
  }

async initializeChain(claim, creatorId) {

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

  const matrix = await approvalMatrixService.determineWorkflow({
    claimType: claimType.code,
    departmentId: claimDepartmentId,
    amount: Number(claim.amount),
    ...(claim.formData || {})
  });

  if (!matrix?.approvers?.length) {
    throw new AppError("No workflow found", 422);
  }


  await prisma.claim.update({
    where: { id: claim.id },
    data: { approvalMatrixId: matrix.id } // requires a nullable approvalMatrixId column on Claim — see schema note below
  });

  const existingChain = await prisma.claimApproval.count({
    where: { claimId: claim.id }
  });

  if (existingChain > 0) {
    throw new AppError("Approval chain already exists for this claim", 400);
  }

  const approvers = [...matrix.approvers].sort((a, b) => a.sequence - b.sequence);

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
      approver?.designation?.title ??
      approver?.name ??
      "APPROVER";
  }

  const updatedClaim = await prisma.$transaction(async (tx) => {

    await tx.claimApproval.createMany({ data: approvalRows });

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
async advance(claim, actor, comments) {

  if (
    claim.status !== "PENDING_APPROVAL" &&
    claim.status !== "PARTIALLY_APPROVED"
  ) {
    throw new AppError("Claim is not awaiting approval", 400);
  }

  this.validateSoD(claim, actor);

  await this.validateDepartmentalHead(claim, actor);
 if (lineItemDecisions?.fieldName && claim.formData?.[lineItemDecisions.fieldName]) {

    const fieldName = lineItemDecisions.fieldName;
    const decisions = lineItemDecisions.decisions || {};

    const updatedItems = claim.formData[fieldName].map((item, idx) => ({
      ...item,
      lineStatus: decisions[idx] ?? item.lineStatus ?? "APPROVED"
    }));

    const newAmount = updatedItems.reduce(
      (sum, item) => item.lineStatus === "REJECTED" ? sum : sum + (Number(item.amount) || 0),
      0
    );

    claim = await prisma.claim.update({
      where: { id: claim.id },
      data: {
        formData: { ...claim.formData, [fieldName]: updatedItems },
        amount: newAmount
      }
    });
  }

  const matrix = claim.approvalMatrixId
    ? await prisma.approvalMatrix.findUnique({ where: { id: claim.approvalMatrixId } })
    : await prisma.approvalMatrix.findFirst({ where: { claimType: claim.claimType?.code } });

  if (matrix?.approvalCommentRequired && !comments) {
    throw new AppError("Approval comments required", 400);
  }

  if (claim.systemStage === "HR") {
    await this.validateActorIsSystemDeptHead(claim, actor, true);
    return this.advanceToFinance(claim, actor);
  }

  if (claim.systemStage === "FINANCE") {
    await this.validateActorIsSystemDeptHead(claim, actor, false);
    return this.finalizeClaim(claim, actor);
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

  this.validateActorCanActOnStep(currentStep, actor, Number(claim.amount));


  const result = await prisma.$transaction(async (tx) => {

    await tx.claimApproval.update({
      where: { id: currentStep.id },
      data: {
        status: "APPROVED",
        actionedAt: new Date(),
        comments: comments ?? null,
        approverId: currentStep.approverId ?? actor.id
      }
    });

    await tx.claimApprovalHistory.create({
      data: {
        claimApprovalId: currentStep.id,
        actorId: actor.id,
        action: "APPROVED",
        comments: comments ?? null
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
          Number(claim.amount)
        );
        eligibleId = eligible?.id ?? null;
      }

      if (!eligibleId) {
        throw new AppError(
          `Unable to resolve approver for next step (sequence ${nextStep.sequence}) on claim ${claim.id}`,
          422
        );
      }

      if (eligibleId && !nextStep.approverId) {
        await tx.claimApproval.update({
          where: { id: nextStep.id },
          data: { approverId: eligibleId }
        });
      }

      let nextRequiredRole = nextStep.role?.name ?? null;

      if (!nextRequiredRole && eligibleId) {
        const nextApprover = await tx.user.findUnique({
          where: { id: eligibleId },
          include: { designation: true }
        });

        nextRequiredRole =
          nextApprover?.designation?.name ??
          nextApprover?.designation?.title ??
          nextApprover?.name ??
          "APPROVER";
      }

      const updatedClaim = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: "PENDING_APPROVAL",
          currentApprovalSequence: nextStep.sequence,
          assignedApproverId: eligibleId,
          requiredApproverRole: nextRequiredRole
        }
      });

      return { updatedClaim, notifyInfo: { type: "next", eligibleId } };
    }

    const financeApprover = await this.findSystemDeptHead(false);

    if (!financeApprover) {
      throw new AppError(
        "Finance approver not configured — claim cannot advance to Finance stage",
        500
      );
    }

    const updatedClaim = await tx.claim.update({
      where: { id: claim.id },
      data: {
        systemStage: "FINANCE",
        currentApprovalSequence: null,
        requiredApproverRole: "FINANCE",
        assignedApproverId: financeApprover?.id ?? null
      }
    });

    return { updatedClaim, notifyInfo: { type: "finance", financeApprover } };
  });



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

  if (result.notifyInfo?.type === "finance") {

    const financeApprover = result.notifyInfo.financeApprover;

    await notificationService.notifyUser(
      financeApprover.id,
      "Finance Approval Required",
      `Claim ${claim.claimNumber || claim.id} requires finance approval`
    );

    const claimWithDocuments = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: { documents: true, claimType: true, creator: true }
    });

    await this.notifyApprover(financeApprover, claim, claimWithDocuments);
  }

  return result.updatedClaim;
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

async reject(claim, actor, comments) {

  let currentStep = null;

  if (claim.status !== "PENDING_APPROVAL") {
    throw new AppError("Claim is not awaiting approval", 400);
  }

  this.validateSoD(claim, actor);

  // FIX: same matrix-pinning fix as advance() above.
  const matrix = claim.approvalMatrixId
    ? await prisma.approvalMatrix.findUnique({ where: { id: claim.approvalMatrixId } })
    : await prisma.approvalMatrix.findFirst({ where: { claimType: claim.claimType?.code } });

  if (matrix?.rejectionCommentRequired && !comments) {
    throw new AppError("Rejection comments required", 400);
  }

  await this.validateDepartmentalHead(claim, actor);

  if (claim.systemStage === "HR") {
    await this.validateActorIsSystemDeptHead(claim, actor, true);
  } else if (claim.systemStage === "FINANCE") {
    await this.validateActorIsSystemDeptHead(claim, actor, false);
  } else {

    currentStep = await prisma.claimApproval.findUnique({
      where: {
        claimId_sequence: {
          claimId: claim.id,
          sequence: claim.currentApprovalSequence
        }
      }
    });

    if (!currentStep) {
      throw new AppError(
        `No approval chain found for claim ${claim.id} at sequence ${claim.currentApprovalSequence}`,
        500
      );
    }

    this.validateActorCanActOnStep(currentStep, actor, claim.amount);

    await prisma.claimApproval.update({
      where: { id: currentStep.id },
      data: {
        status: "REJECTED",
        approverId: actor.id,
        actionedAt: new Date(),
        comments: comments ?? null
      },
    });
  }

  if (currentStep) {
    await prisma.claimApprovalHistory.create({
      data: {
        claimApprovalId: currentStep.id,
        actorId: actor.id,
        action: "REJECTED",
        comments
      }
    });
  }

  return prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "REJECTED",
      rejectedBy: actor.id,
      rejectionComments: comments ?? null,
      currentApprovalSequence: null,
      assignedApproverId: null,
      systemStage: null,
    },
  });
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
