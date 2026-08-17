const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

class UserModel {

    async create(data) {
        return prisma.user.create({
            data
        });
    }

    async findAll() {
        return prisma.user.findMany({
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                }
            }
        });
    }

    async findById(id) {
        return prisma.user.findUnique({
            where: { id },
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                }
            }
        });
    }

    async findByEmail(email) {
        return prisma.user.findUnique({
            where: { email }
        });
    }

    async update(id, data) {
        return prisma.user.update({
            where: { id },
            data
        });
    }

    async delete(id) {
        return prisma.user.delete({
            where: { id }
        });
    }

}

module.exports = new UserModel();