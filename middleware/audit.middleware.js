const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

module.exports = (action, moduleName) => {

    return async (req, res, next) => {

      res.on("finish", async () => {
    try {
        await prisma.auditLog.create({
            data: {
                user: {
                    connect: {
                        id: req.user.id
                    }
                },
                action,
                module: moduleName,
                entity: moduleName,
                entityId: req.params.id || req.body?.id || res.locals.entityId || null,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
                statusCode: res.statusCode,         
                success: res.statusCode < 400        
            }
        });
    } catch (e) {
        console.error(e);
    }
});

        next();

    };

};