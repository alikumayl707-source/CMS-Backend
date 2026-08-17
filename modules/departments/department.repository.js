const { PrismaClient } =
  require("@prisma/client");

const prisma =
  new PrismaClient();

class DepartmentRepository {

  async findAll() {

    return prisma.department.findMany({
      orderBy: {
        name: "asc"
      }
    });

  }

  async findById(id) {

    return prisma.department.findUnique({
      where: {
        id
      }
    });

  }

  async create(data) {

    return prisma.department.create({
      data: {
        name: data.name
      }
    });

  }

async update(id, data) {
  return prisma.department.update({
    where: { id },
    data: {
      name: data.name,
      isHRDept: data.isHRDept ?? undefined,
      isFinanceDept: data.isFinanceDept ?? undefined,
    }
  });
}

  async delete(id) {

    return prisma.department.delete({
      where: {
        id
      }
    });

  }

}

module.exports =
  new DepartmentRepository();