const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const escalationSettingsService = require("../workflow/escalation-settings.service");

class WorkflowDashboardRepository {

  async getDashboard(page = 1, pageSize = 5) {
    const skip = (page - 1) * pageSize;

    const [totalRecords, workflows, settings] = await Promise.all([
      prisma.approvalMatrix.count(),
      prisma.approvalMatrix.findMany({
        skip,
        take: pageSize,
        include: {
          department: true,
          approvers: {
            include: { role: true, specificUser: true, department: true },
            orderBy: { sequence: 'asc' }
          }
        },
        orderBy: { id: 'desc' }
      }),
      escalationSettingsService.get()
    ]);

    const workflowIds = workflows.map(w => w.id);

    const [allStats, overdueCounts] = await Promise.all([
      workflowIds.length > 0
        ? prisma.claim.groupBy({
            by: ['approvalMatrixId', 'status'],
            where: { approvalMatrixId: { in: workflowIds } },
            _count: { id: true }
          })
        : [],
      this._getOverdueCounts(workflowIds, settings.escalateAfterHours)
    ]);

    const statsByWorkflow = new Map();
    for (const row of allStats) {
      if (!statsByWorkflow.has(row.approvalMatrixId)) {
        statsByWorkflow.set(row.approvalMatrixId, {});
      }
      statsByWorkflow.get(row.approvalMatrixId)[row.status] = row._count.id;
    }

    const data = workflows.map((workflow) => {
      const stats = statsByWorkflow.get(workflow.id) || {};

      return {
        workflowId: workflow.id,
        workflowName: workflow.workflowName,
        claimType: workflow.claimType,
        department: workflow.department?.name,
        status: workflow.status,
        approvalPattern: workflow.approvalPattern,

        approvalChain: workflow.approvers.map(x => ({
          sequence: x.sequence,
          department: x.department?.name || null,
          approver: x.role?.name || x.specificUser?.name || 'N/A'
        })),

        statistics: {
          pending: stats['PENDING_APPROVAL'] || 0,
          partiallyApproved: stats['PARTIALLY_APPROVED'] || 0,
          approved: stats['APPROVED'] || 0,
          rejected: stats['REJECTED'] || 0,
          returned: stats['RETURNED'] || 0,
          // Claims sitting in this workflow's pending states for longer
          // than the currently-configured escalation threshold —
          // see EscalationSettings / escalation.service.js.
          overdue: overdueCounts.get(workflow.id) || 0
        }
      };
    });

    return {
      data,
      escalationSettings: settings,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
        hasNext: page * pageSize < totalRecords,
        hasPrevious: page > 1
      }
    };
  }

  /*
   * Cheap approximation for the dashboard summary cards: uses
   * claim.updatedAt as a proxy for "time in current stage". This is
   * good enough for an at-a-glance overdue COUNT per workflow.
   *
   * getWorkflowClaims()/getClaimWorkflow() below use the more precise
   * per-ClaimApproval-row createdAt (matching escalation.service.js's
   * own age calculation exactly) when looking at an individual claim.
   */
  async _getOverdueCounts(workflowIds, escalateAfterHours) {

    if (!workflowIds.length) {
      return new Map();
    }

    const cutoff = new Date(Date.now() - escalateAfterHours * 36e5);

    const overdueClaims = await prisma.claim.findMany({
      where: {
        approvalMatrixId: { in: workflowIds },
        status: { in: ["PENDING_APPROVAL", "PARTIALLY_APPROVED"] },
        updatedAt: { lte: cutoff }
      },
      select: { approvalMatrixId: true }
    });

    const map = new Map();
    for (const c of overdueClaims) {
      map.set(c.approvalMatrixId, (map.get(c.approvalMatrixId) || 0) + 1);
    }
    return map;
  }

  async getWorkflowById(id) {
    return prisma.approvalMatrix.findUnique({
      where: { id },
      include: {
        department: true,
        rules: true,
        escalations: true,
        approvers: {
          include: { role: true, specificUser: true },
          orderBy: { sequence: "asc" }
        }
      }
    });
  }

  async getWorkflowClaims(workflowId) {
    const workflow = await prisma.approvalMatrix.findUnique({
      where: { id: workflowId }
    });

    if (!workflow) {
      return [];
    }

    const settings = await escalationSettingsService.get();

    const claims = await prisma.claim.findMany({
      where: { approvalMatrixId: workflow.id },
      include: {
        assignedApprover: { select: { id: true, name: true } },
        claimType: true
      },
      orderBy: { createdAt: "desc" }
    });

    const now = Date.now();
    const activeStatuses = ["PENDING_APPROVAL", "PARTIALLY_APPROVED"];

    return claims.map(claim => {
      const hoursInCurrentStage = Math.round(
        (now - new Date(claim.updatedAt).getTime()) / 36e5
      );

      return {
        ...claim,
        hoursInCurrentStage,
        isOverdue:
          activeStatuses.includes(claim.status) &&
          hoursInCurrentStage >= settings.escalateAfterHours
      };
    });
  }

  async getClaimWorkflow(claimId) {
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        claimType: true,
        assignedApprover: true,
        approvals: {
          include: { approver: true, role: true },
          orderBy: { sequence: "asc" }
        }
      }
    });

    if (!claim) {
      return null;
    }

    const settings = await escalationSettingsService.get();
    const now = Date.now();

    return {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      currentSequence: claim.currentApprovalSequence,
      currentApprover: claim.assignedApprover?.name,
      workflowSteps: claim.approvals.map(step => {

        const stepStart = new Date(step.createdAt).getTime();
        const stepEnd = step.actionedAt ? new Date(step.actionedAt).getTime() : now;
        const hoursInStep = Math.round((stepEnd - stepStart) / 36e5);

        return {
          id: step.id,
          sequence: step.sequence,
          approver: step.approver?.name,
          role: step.role?.name,
          status: step.status,
          actionedAt: step.actionedAt,
          comments: step.comments,
          hoursInStep,
          isOverdue: step.status === "PENDING" && hoursInStep >= settings.escalateAfterHours
        };
      })
    };
  }
}

module.exports = new WorkflowDashboardRepository();
