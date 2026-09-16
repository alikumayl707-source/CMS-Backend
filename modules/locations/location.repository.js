const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class LocationRepository {

  async findAll() {
    return prisma.location.findMany({ orderBy: { name: "asc" } });
  }

  async create(name) {
    return prisma.location.create({ data: { name } });
  }

 async findDepartments(locationId) {
    const rows = await prisma.user.findMany({
      where: {
        locationId: Number(locationId),
        orgSyncedAt: { not: null },
        departmentId: { not: null }
      },
      distinct: ["departmentId"],
      select: {
        department: { select: { id: true, name: true } }
      }
    });

    return rows.map(r => r.department).filter(Boolean);
  }

  // MODIFIED — ab optional departmentId bhi filter karta hai
  async findUsers(locationId, departmentId) {
    return prisma.user.findMany({
      where: {
        locationId: Number(locationId),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        orgSyncedAt: { not: null }
      },
      include: { designation: true },
      orderBy: { name: "asc" }
    });
  }
}

module.exports = new LocationRepository();