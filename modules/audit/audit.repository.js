const prisma = require("../../prisma/index");

async function getAuditLogs(
  page = 1,
  pageSize = 10,
  search = "",
  filters = {}
) {
  const skip = (page - 1) * pageSize;

  const where = {
    ...(search && {
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { module: { contains: search, mode: "insensitive" } },
      ],
    }),

    ...(filters.action && {
      action: {
        contains: filters.action,
        mode: "insensitive",
      },
    }),

    ...(filters.module && {
      module: {
        contains: filters.module,
        mode: "insensitive",
      },
    }),

    ...(filters.entity && {
      entity: {
        contains: filters.entity,
        mode: "insensitive",
      },
    }),

    ...(filters.statusCode && {
      statusCode: Number(filters.statusCode),
    }),

    ...(filters.success !== undefined &&
      filters.success !== "" && {
        success: filters.success === "true",
      }),

    ...(filters.userName && {
      user: {
        name: {
          contains: filters.userName,
          mode: "insensitive",
        },
      },
    }),

    ...(filters.userEmail && {
      user: {
        email: {
          contains: filters.userEmail,
          mode: "insensitive",
        },
      },
    }),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),

    prisma.auditLog.findMany({
      where,
      skip,
      take: Number(pageSize),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const enrichedData = logs.map((log) => ({
    ...log,
    statusLabel: log.success ? "Success" : "Failed",
    userDisplayName: log.user?.name || "System",
  }));

  return {
    data: enrichedData,
    pagination: {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    },
  };
}

async function getAuditById(id) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });
}

module.exports = {
  getAuditLogs,
  getAuditById   
};
