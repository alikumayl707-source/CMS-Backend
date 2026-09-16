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
      ...(workflowName ? { workflowName: { contains: workflowName } } : {}),
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
              location: true,
              specificUser: { include: { designation: true } }
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
        ? Number(data.departmentId) : null;

    const minAmount = Number(data.minAmount);
    const maxAmount = Number(data.maxAmount);

    const overlapping = await prisma.approvalMatrix.findFirst({
      where: {
        claimType: data.claimType,
        departmentId: resolvedDepartmentId,
        minAmount: { lt: maxAmount },
        maxAmount: { gt: minAmount },
      
        status: { not: "DRAFT" }
      }
    });

    if (overlapping) {
      throw new Error(
        `An overlapping approval workflow already exists for claim type ${data.claimType}, ` +
        `department ${resolvedDepartmentId}, range ${overlapping.minAmount}-${overlapping.maxAmount}`
      );
    }

    const {
      approverUserIds,
      approvers,
      departmentMappings = [],
      locationMappings = [],
      departmentId,
      approvalPattern,
      rules = [],
      vendorEmail,
      escalations = [],
      isActive,
      status,
      ...rest
    } = data;

    const allSpecificApproverIds = [
      ...(Array.isArray(approverUserIds) ? approverUserIds : []),
      ...departmentMappings.flatMap(dm => dm.approverUserIds || []),
      ...locationMappings.flatMap(lm => lm.approverUserIds || [])
    ];

    if (allSpecificApproverIds.length > 0) {
      const uniqueIds = [...new Set(allSpecificApproverIds)];
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueIds }, orgSyncedAt: { not: null } },
        select: { id: true }
      });
      if (users.length !== uniqueIds.length) {
        throw new Error("All approvers must be Entra synced users");
      }
    }


    const resolvedStatus = status || (isActive === false ? "DRAFT" : "ACTIVE");
    const resolvedIsActive = resolvedStatus === "DRAFT" ? false : (isActive ?? true);

    return prisma.$transaction(async (tx) => {
      const matrix = await tx.approvalMatrix.create({
        data: {
          ...rest,
          vendorEmail,
          approvalPattern,
          departmentId: resolvedDepartmentId,
          isActive: resolvedIsActive,
          status: resolvedStatus
        }
      });

if (locationMappings.length > 0) {
  const approverRows = [];
  for (const mapping of locationMappings) {
    let sequence = 1;
    for (const userId of mapping.approverUserIds) {
      approverRows.push({
        approvalMatrixId: matrix.id,
        locationId: mapping.locationId,
        departmentId: mapping.departmentId ?? null,   
        specificUserId: userId,
        sequence: sequence++,
        isParallel: false,
        groupKey: null
      });
    }
  }
  await tx.approvalMatrixApprover.createMany({ data: approverRows });

} else if (departmentMappings.length > 0) {
  
        const approverRows = [];
        for (const mapping of departmentMappings) {
          let sequence = 1;
          for (const userId of mapping.approverUserIds) {
            approverRows.push({
              approvalMatrixId: matrix.id,
              departmentId: mapping.departmentId,
              specificUserId: userId,
              sequence: sequence++,
              isParallel: false,
              groupKey: null
            });
          }
        }
        await tx.approvalMatrixApprover.createMany({ data: approverRows });

      } else if (Array.isArray(approverUserIds) && approverUserIds.length > 0) {
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
          data: approvers.map((roleId, idx) => ({ approvalMatrixId: matrix.id, roleId, sequence: idx + 1 }))
        });
      }

      if (rules.length) {
        await tx.workflowRule.createMany({
          data: rules.map(rule => ({
            approvalMatrixId: matrix.id, field: rule.field, operator: rule.operator, value: String(rule.value),
            conditionGroup: rule.conditionGroup ?? null, approverRole: rule.approverRole ?? null, approverUserId: rule.approverUserId ?? null
          }))
        });
      }

      if (escalations.length) {
        await tx.workflowEscalation.createMany({
          data: escalations.map(e => ({
            approvalMatrixId: matrix.id, afterHours: Number(e.afterHours), action: e.action, targetDesignationId: Number(e.targetDesignationId)
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
              department: true,
              location: true,
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
        // FIX: DRAFT workflows ko naye claims match/route karne se explicitly rok do,
        // chahe isActive kisi wajah se true reh gaya ho
        status: { not: "DRAFT" },
        ...(departmentId
          ? { OR: [{ departmentId }, { departmentId: null }] }
          : { departmentId: null }),
        ...(amount != null && !Number.isNaN(amount)
          ? { minAmount: { lte: amount }, maxAmount: { gte: amount } }
          : {})
      },
      include: {
        rules: true,
        escalations: true,
        approvers: { include: { role: true, location: true, specificUser: true } }
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
        status: { not: "DRAFT" }, // FIX: yahan bhi DRAFT exclude karo
        ...(departmentId ? { departmentId: Number(departmentId) } : {})
      },
      orderBy: { minAmount: "desc" },
      include: {
        approvers: {
          orderBy: { sequence: "asc" },
          include: { role: true, location: true, specificUser: { include: { designation: true } } }
        }
      }
    });
  }
}

module.exports = new ApprovalMatrixRepository();
