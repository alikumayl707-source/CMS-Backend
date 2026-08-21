const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

class PermissionModel {

    async create(data) {
        return prisma.permission.create({
            data
        });
    }

    async findAll() {
        return prisma.permission.findMany({
            orderBy: {
                module: "asc"
            }
        });
    }

    async findByKey(key) {
        return prisma.permission.findUnique({
            where: { key }
        });
    }

    async update(id, data) {
        return prisma.permission.update({
            where: { id },
            data
        });
    }

    async delete(id) {
        return prisma.permission.delete({
            where: { id }
        });
    }

}

module.exports = new PermissionModel();