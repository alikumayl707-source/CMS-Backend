const prisma = require("../../prisma/index");

/** Trimmed string, or undefined when empty. */
const text = value => {
  const v = String(value ?? "").trim();
  return v || undefined;
};

// MySQL's default collation already compares case-insensitively, and Prisma
// rejects `mode: "insensitive"` on MySQL, so plain `contains` is enough.
function buildWhere(search, filters = {}) {
  const and = [];

  const term = text(search);
  if (term) {
    and.push({
      OR: [
        { action: { contains: term } },
        { entity: { contains: term } },
        { module: { contains: term } },
        { entityId: { contains: term } },
        { user: { name: { contains: term } } }
      ]
    });
  }

  if (text(filters.action)) and.push({ action: { contains: text(filters.action) } });
  if (text(filters.module)) and.push({ module: { contains: text(filters.module) } });
  if (text(filters.entity)) and.push({ entity: { contains: text(filters.entity) } });

  const statusCode = Number(filters.statusCode);
  if (text(filters.statusCode) && Number.isInteger(statusCode)) {
    and.push({ statusCode });
  }

  if (filters.success === "true" || filters.success === "false") {
    and.push({ success: filters.success === "true" });
  }

  // Name and email are combined, so one can't overwrite the other.
  const user = {
    ...(text(filters.userName) ? { name: { contains: text(filters.userName) } } : {}),
    ...(text(filters.userEmail) ? { email: { contains: text(filters.userEmail) } } : {})
  };
  if (Object.keys(user).length) and.push({ user });

  return and.length ? { AND: and } : {};
}

async function getAuditLogs(page = 1, pageSize = 10, search = "", filters = {}) {
  const skip = (page - 1) * pageSize;
  const where = buildWhere(search, filters);

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    data: logs.map(log => ({
      ...log,
      statusLabel: log.success ? "Success" : "Failed",
      userDisplayName: log.user?.name || "System"
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1
    }
  };
}

async function getAuditById(id) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });
}

module.exports = {
  getAuditLogs,
  getAuditById
};