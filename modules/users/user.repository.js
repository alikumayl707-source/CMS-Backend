const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

class UserRepository {

    async create(data) {
        return prisma.user.create({ data });
    }

async findAll() {

  const users =
    await prisma.user.findMany({

      include: {

        department: true,

        designation: true,

        reportsTo: true,

        userRoles: {
          include: {
            role: true
          }
        }

      }

    });

  return users.map(user => ({

    userId: user.id,

    displayName: user.name,

    managerId:
      user.reportsToId,
email: user.email,
    managerName:
      user.reportsTo?.name || null,

    approvalLimit:
      Number(
        user.approvalLimit || 0
      ),


    attributes: {

      department:
        user.department?.name || '',

      designation:
        user.designation?.name || '',

     
      designationApprovalLimit:
        Number(
          user.designation?.defaultApprovalLimit || 0
        )

    }

  }));

}

async findById(id) {

  const user =
    await prisma.user.findUnique({

      where: { id },

include: {
  department: true,
  designation: true,
  reportsTo: true,
  userRoles: {
    include: {
      role: true
    }
  }
}

    });

  if (!user) {
    return null;
  }

return {

  userId: user.id,

  displayName: user.name,

  managerId:
    user.reportsToId,
email: user.email,
  managerName:
    user.reportsTo?.name || null,

  approvalLimit:
    Number(
      user.approvalLimit || 0
    ),

  userRoles:
    user.userRoles,

  attributes: {

    department:
      user.department?.name || '',

    designation:
      user.designation?.name || ''

  }

};

}

    async findByEmail(email) {
        return prisma.user.findUnique({
            where: { email },
            include: {
                userRoles: {
                    include: {
                     role: {
  include: {

    rolePermissions: {
      include: {
        permission: true
      }
    },

    roleConditions: true

  }
}
                    }
                }
            }
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

    async assignRole(userId, roleId) {
        return prisma.userRole.create({
            data: { userId, roleId }
        });
    }

async removeRole(userId, roleId) {

  return prisma.userRole.deleteMany({
    where: {
      userId: Number(userId),
      roleId: Number(roleId)
    }
  });

}

async getPermissions(userId) {
  return prisma.user.findUnique({
      where: { id: userId },
      include: {
          // NEW — without these, access.evaluator.js's resolveAttributeValue
          // had nothing to read for department/designation-scoped conditions
          // on the USER side.
          department: true,
          designation: true,
          userRoles: {
              include: {
                  role: {
                      include: {
                          rolePermissions: {
                              include: {
                                  permission: true
                              }
                          },
                          roleConditions: true
                      }
                  }
              }
          }
      }
  });
}

}

module.exports = new UserRepository();