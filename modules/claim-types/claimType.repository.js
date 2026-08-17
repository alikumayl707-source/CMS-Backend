const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

class ClaimTypeRepository {

    async create(data) {
        return prisma.claimType.create({
            data
        });
    }

    async findAll({ activeOnly = false } = {}) {
        return prisma.claimType.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: {
                name: "asc"
            }
        });
    }

    async findById(id) {
        return prisma.claimType.findUnique({
            where: { id }
        });
    }

    async findByCode(code) {
        return prisma.claimType.findUnique({
            where: { code }
        });
    }

    async update(id, data) {
        return prisma.claimType.update({
            where: { id },
            data
        });
    }

    async delete(id) {
        return prisma.claimType.delete({
            where: { id }
        });
    }

}

module.exports = new ClaimTypeRepository();
