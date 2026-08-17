const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class WorkflowDashboardRepository {

  async getDashboard(page = 1, pageSize = 5) {

    const skip = (page - 1) * pageSize;

    const [totalRecords, workflows] = await Promise.all([
      prisma.approvalMatrix.count(),

      prisma.approvalMatrix.findMany({
        skip,
        take: pageSize,
        include: {
          department: true,
          approvers: {
            include: { role: true, specificUser: true },
            orderBy: { sequence: 'asc' }
          }
        },
        orderBy: { id: 'desc' }
      })
    ]);

    const data = await Promise.all(
      workflows.map(async (workflow) => {

        const stats = await prisma.claim.groupBy({
  by: ['status'],
  where: {
    approvalMatrixId: workflow.id
  },
  _count: {
    id: true
  }
});
        return {
          workflowId: workflow.id,
          workflowName: workflow.workflowName,
          claimType: workflow.claimType,
          department: workflow.department?.name,
          status: workflow.status,
          approvalPattern: workflow.approvalPattern,

          approvalChain: workflow.approvers.map(x => ({
            sequence: x.sequence,
            approver: x.role?.name || x.specificUser?.name || 'N/A'
          })),

          statistics: {
            pending: stats.find(x => x.status === 'PENDING_APPROVAL')?._count.id || 0,
            approved: stats.find(x => x.status === 'APPROVED')?._count.id || 0,
            rejected: stats.find(x => x.status === 'REJECTED')?._count.id || 0,
            returned: stats.find(x => x.status === 'RETURNED')?._count.id || 0
          }
        };
      })
    );

    return {
      data,
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

return prisma.claim.findMany({
  where: {
    approvalMatrixId: workflow.id
  },
  include: {
    assignedApprover: {
      select: {
        id: true,
        name: true
      }
    },
    claimType: true
  },
  orderBy: {
    createdAt: "desc"
  }
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

    return {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      currentSequence: claim.currentApprovalSequence,
      currentApprover: claim.assignedApprover?.name,
      workflowSteps: claim.approvals.map(step => ({
        id: step.id,
        sequence: step.sequence,
        approver: step.approver?.name,
        role: step.role?.name,
        status: step.status,
        actionedAt: step.actionedAt,
        comments: step.comments
      }))
    };
  }
}

module.exports = new WorkflowDashboardRepository();
