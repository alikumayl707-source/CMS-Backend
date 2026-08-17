const { PrismaClient } =
  require("@prisma/client");

const prisma =
  new PrismaClient({
    datasourceUrl:
      process.env.DATABASE_URL
  });

class OrganizationRepository {


async getHierarchy({
  page = 1,
  pageSize = 10,
  search,
  filters = {}
}) {

  const where = {
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search
              }
            }
          ]
        }
      : {}),

    ...(filters.name
      ? {
          name: {
            contains: filters.name
          }
        }
      : {}),

    ...(filters['department.name']
      ? {
          department: {
            name: {
              contains: filters['department.name']
            }
          }
        }
      : {}),

    ...(filters['designation.name']
      ? {
          designation: {
            name: {
              contains: filters['designation.name']
            }
          }
        }
      : {}),

    ...(filters['reportsTo.name']
      ? {
          reportsTo: {
            name: {
              contains: filters['reportsTo.name']
            }
          }
        }
      : {})
  };

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        department: true,
        designation: true,
        reportsTo: true
      }
    }),
    prisma.user.count({ where })
  ]);


  const enrichedData = data.map(user => {
    const personalLimit =
      user.approvalLimit !== null && user.approvalLimit !== undefined
        ? Number(user.approvalLimit)
        : null;

    const designationDefault =
      user.designation?.defaultApprovalLimit !== null &&
      user.designation?.defaultApprovalLimit !== undefined
        ? Number(user.designation.defaultApprovalLimit)
        : null;

    let effectiveApprovalLimit = null;
    let approvalLimitSource = "none";

    if (personalLimit !== null) {
      effectiveApprovalLimit = personalLimit;
      approvalLimitSource = "personal";
    } else if (designationDefault !== null) {
      effectiveApprovalLimit = designationDefault;
      approvalLimitSource = "designation";
    }

    return {
      ...user,
      approvalLimit: personalLimit,
      effectiveApprovalLimit,
      approvalLimitSource 
    };
  });

  return {
    data: enrichedData,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

  async updateHierarchy(
    userId,
    data
  ) {

    return prisma.user.update({

      where: {
        id: userId
      },

      data

    });

  }

  async assignManager(
    employeeId,
    managerId
  ) {

    return prisma.user.update({

      where: {
        id: employeeId
      },

      data: {
        reportsToId:
          managerId
      }

    });

  }

  async assignDepartment(
    employeeId,
    departmentId
  ) {

    return prisma.user.update({

      where: {
        id: employeeId
      },

      data: {
        departmentId
      }

    });

  }

  async assignDesignation(
    employeeId,
    designationId
  ) {

    return prisma.user.update({

      where: {
        id: employeeId
      },

      data: {
        designationId
      }

    });

  }

  async updateApprovalLimit(
    employeeId,
    limit
  ) {

    return prisma.user.update({

      where: {
        id: employeeId
      },

      data: {
        approvalLimit:
          limit
      }

    });

  }
async getByDepartment(departmentId) {
  return prisma.user.findMany({
    where: { departmentId: Number(departmentId) },
    include: {
      designation: true,
      department: true,
      reportsTo: {
        select: { id: true, name: true, designation: true }
      }
    },
    orderBy: { name: "asc" }
  });
}
async getFullHierarchy() {
  return prisma.user.findMany({
    include: {
      department: true,
      //designation: true,
      //reportsTo: true
    },
    orderBy: { name: "asc" }
  });
}
  async findEligibleApprover(
    startUserId,
    requiredRoleName,
    claimAmount,
    maxDepth = 10
  ) {

    let currentUserId = startUserId;

    for (let depth = 0; depth < maxDepth; depth++) {

      const currentUser =
        await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { reportsToId: true }
        });

      if (!currentUser || !currentUser.reportsToId) {
        return null; // reached the top of the chain
      }

      const manager =
        await prisma.user.findUnique({
          where: { id: currentUser.reportsToId },
          include: {
            designation: true,
            userRoles: {
              include: { role: true }
            }
          }
        });

      if (!manager) {
        return null;
      }

      const hasRequiredRole =
        manager.userRoles.some(
          ur => ur.role.name === requiredRoleName
        );

      const effectiveLimit =
        Number(
          manager.approvalLimit ??
          manager.designation?.defaultApprovalLimit ??
          0
        );

      if (hasRequiredRole && effectiveLimit >= Number(claimAmount)) {
        return manager;
      }

      currentUserId = manager.id; 
    }

    return null;

  }

}

module.exports =
  new OrganizationRepository();