const { PrismaClient } =
  require("@prisma/client");

const prisma =
  new PrismaClient();

class DesignationRepository {

  async findAll() {

    return prisma.designation.findMany({
      orderBy: {
        name: "asc"
      }
    });

  }

  async create(data) {

    return prisma.designation.create({
      data: {
        name: data.name
      }
    });

  }

  async update(id, data) {

    return prisma.designation.update({
      where: {
        id
      },
      data: {
        name: data.name
      }
    });

  }

  async delete(id) {

    return prisma.designation.delete({
      where: {
        id
      }
    });

  }

}

module.exports =
  new DesignationRepository();