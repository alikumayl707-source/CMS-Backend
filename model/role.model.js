const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

class RoleModel {

    async create(data) {
        return prisma.role.create({
            data
        });
    }

    async findAll() {
        return prisma.role.findMany({
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });
    }

    async findById(id) {
        return prisma.role.findUnique({
            where: { id },
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });
    }

    async update(id, data) {
        return prisma.role.update({
            where: { id },
            data
        });
    }

    async delete(id) {
        return prisma.role.delete({
            where: { id }
        });
    }

}

module.exports = new RoleModel();