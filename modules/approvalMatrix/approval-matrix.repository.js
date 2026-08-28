const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class ApprovalMatrixRepository {

  async getAll({
    page = 1,
    pageSize = 10,
    search,
    claimType,
    departmentId,
    workflowName,
    status
  }) {

    page = Number(page);
    pageSize = Number(pageSize);

    const skip = (page - 1) * pageSize;

    const where = {

      ...(search
        ? {
            OR: [
              { claimType: { contains: search } },
              { workflowName: { contains: search } }
            ]
          }
        : {}),

      ...(claimType ? { claimType } : {}),

      ...(departmentId ? { departmentId: Number(departmentId) } : {}),

      ...(workflowName
        ? { workflowName: { contains: workflowName } }
        : {}),

      ...(status ? { status } : {})

    };

    const [data, total] = await prisma.$transaction([

      prisma.approvalMatrix.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { id: "desc" },
        include: {
          department: true,
          rules: true,
          escalations: true,
          approvers: {
            orderBy: { sequence: "asc" },
            include: {
              role: true,
              specificUser: {
                include: { designation: true }
              }
            }
          }
        }
      }),

      prisma.approvalMatrix.count({ where })

    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

 async create(data) {

  const resolvedDepartmentId =
    data.departmentId !== undefined && data.departmentId !== null
      ? Number(data.departmentId)
      : null;

  const minAmount = Number(data.minAmount);
  const maxAmount = Number(data.maxAmount);


  const overlapping = await prisma.approvalMatrix.findFirst({
    where: {
      claimType: data.claimType,
      departmentId: resolvedDepartmentId,
      minAmount: { lt: maxAmount },
      maxAmount: { gt: minAmount }
    }
  });

  if (overlapping) {
    throw new Error(
      `An overlapping approval workflow already exists for claim type ${data.claimType}, ` +
      `department ${resolvedDepartmentId}, range ${overlapping.minAmount}-${overlapping.maxAmount}`
    );
  }



    const existingWorkflow = await prisma.approvalMatrix.findFirst({
      where: {
        claimType: data.claimType,
        departmentId: resolvedDepartmentId
      }
    });

    if (existingWorkflow) {
      throw new Error(
        `Approval workflow already exists for claim type ${data.claimType} and department ${resolvedDepartmentId}`
      );
    }

    const {
      approverUserIds,
      approvers,
      departmentId,
      approvalPattern,
      rules = [],
      vendorEmail,
      escalations = [],
      isActive,
      ...rest
    } = data;

    if (Array.isArray(approverUserIds) && approverUserIds.length > 0) {

      const users = await prisma.user.findMany({
        where: {
          id: { in: approverUserIds },
          orgSyncedAt: { not: null }
        },
        select: { id: true }
      });

      if (users.length !== approverUserIds.length) {
        throw new Error("All approvers must be Entra synced users");
      }
    }

    return prisma.$transaction(async (tx) => {

      const matrix = await tx.approvalMatrix.create({
        data: {
          ...rest,
          vendorEmail,
          approvalPattern,
          departmentId: resolvedDepartmentId,
          isActive: isActive ?? true
        }
      });

      if (Array.isArray(approverUserIds) && approverUserIds.length > 0) {

        await tx.approvalMatrixApprover.createMany({
          data: approverUserIds.map((userId, idx) => ({
            approvalMatrixId: matrix.id,
            specificUserId: userId,
            sequence: approvalPattern === "PARALLEL" ? 1 : idx + 1,
            isParallel: approvalPattern === "PARALLEL",
            groupKey: approvalPattern === "PARALLEL" ? "GROUP1" : null
          }))
        });

      } else if (Array.isArray(approvers) && approvers.length) {

        await tx.approvalMatrixApprover.createMany({
          data: approvers.map((roleId, idx) => ({
            approvalMatrixId: matrix.id,
            roleId,
            sequence: idx + 1
          }))
        });
      }

      if (rules.length) {
        await tx.workflowRule.createMany({
          data: rules.map(rule => ({
            approvalMatrixId: matrix.id,
            field: rule.field,
            operator: rule.operator,
            value: String(rule.value),
            conditionGroup: rule.conditionGroup ?? null,
            approverRole: rule.approverRole ?? null,
            approverUserId: rule.approverUserId ?? null
          }))
        });
      }

      if (escalations.length) {
        await tx.workflowEscalation.createMany({
          data: escalations.map(e => ({
            approvalMatrixId: matrix.id,
            afterHours: Number(e.afterHours),
            action: e.action,
            targetDesignationId: Number(e.targetDesignationId)
          }))
        });
      }

      return tx.approvalMatrix.findUnique({
        where: { id: matrix.id },
        include: {
          rules: true,
          escalations: true,
          approvers: {
            orderBy: { sequence: "asc" },
            include: {
              role: true,
              specificUser: { include: { designation: true } }
            }
          }
        }
      });
    });
  }

  async getMatchingWorkflow(claimType, departmentId, amount) {

    const workflows = await prisma.approvalMatrix.findMany({
      where: {
        claimType,
        isActive: true,
        ...(departmentId
          ? { OR: [{ departmentId }, { departmentId: null }] }
          : { departmentId: null }),
        ...(amount != null && !Number.isNaN(amount)
          ? {
              minAmount: { lte: amount },
              maxAmount: { gte: amount }
            }
          : {})
      },
      include: {
        rules: true,
        escalations: true,
        approvers: {
          include: { role: true, specificUser: true }
        }
      }
    });
   return workflows.sort((a, b) => {

      const aSpecific = a.departmentId != null ? 1 : 0;
      const bSpecific = b.departmentId != null ? 1 : 0;
      if (aSpecific !== bSpecific) return bSpecific - aSpecific;

      const aRange = Number(a.maxAmount) - Number(a.minAmount);
      const bRange = Number(b.maxAmount) - Number(b.minAmount);
      if (aRange !== bRange) return aRange - bRange;

      if (a.version !== b.version) return b.version - a.version;

      return b.id - a.id;
    });
  }

  async determineApprover(amount, claimType, departmentId) {
    return prisma.approvalMatrix.findFirst({
      where: {
        claimType,
        minAmount: { lte: amount },
        maxAmount: { gte: amount },
        ...(departmentId ? { departmentId: Number(departmentId) } : {})
      },
      orderBy: { minAmount: "desc" },
      include: {
        approvers: {
          orderBy: { sequence: "asc" },
          include: { role: true, specificUser: { include: { designation: true } } }
        }
      },
    });
  }
}

module.exports = new ApprovalMatrixRepository();
