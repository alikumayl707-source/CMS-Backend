const prisma =
  require("../prisma/index");

class AuditLogger {

  async log({
    action,
    module,
    entity,
    entityId,
    userId,
    req
  }) {

    try {

      await prisma.auditLog.create({
        data: {
          userId: userId || null,

          action,

          module,

          entity:
            entity || null,

          entityId:
            entityId?.toString() || null,

          ipAddress:
            req?.headers[
              "x-forwarded-for"
            ] ||
            req?.socket?.remoteAddress ||
            null,

          userAgent:
            req?.headers[
              "user-agent"
            ] || null
        }
      });

    } catch (error) {

      console.error(
        "Audit Log Error:",
        error.message
      );

    }
  }
}

module.exports =
  new AuditLogger();