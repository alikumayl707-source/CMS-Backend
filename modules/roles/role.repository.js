const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const roleWithPermissions = {
  rolePermissions: {
    include: { permission: true }
  },
  roleConditions: true
};

class RoleRepository {

  async create(data) {

    const { id, permissionKeys, ...roleData } = data;

    const role = await prisma.role.create({ data: roleData });

    if (Array.isArray(permissionKeys)) {
      await this.setPermissions(role.id, permissionKeys);
    }

    return this.findById(role.id);
  }

  async findAll() {

    const roles = await prisma.role.findMany({
      include: roleWithPermissions
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissionKeys: role.rolePermissions.map(rp => rp.permission.key),
      roleConditions: role.roleConditions
    }));
  }

  async addCondition(roleId, condition) {
    return prisma.roleCondition.create({
      data: {
        roleId,
        target: condition.target,
        attribute: condition.attribute,
        operator: condition.operator,
        value: condition.value
      }
    });
  }

  // FIX: this method did not exist anywhere in the codebase — repository,
  // service, or otherwise — even though role.controller.js and role.routes.js
  // both wire up a DELETE /:id/conditions/:conditionId endpoint that depends
  // on it. Calling that endpoint would have thrown immediately.
  async removeCondition(roleId, conditionId) {
    return prisma.roleCondition.deleteMany({
      where: {
        id: Number(conditionId),
        roleId: Number(roleId)
      }
    });
  }

  async findById(id) {

    const role = await prisma.role.findUnique({
      where: { id },
      include: roleWithPermissions
    });

    if (!role) {
      return null;
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissionKeys: role.rolePermissions.map(rp => rp.permission.key),
      roleConditions: role.roleConditions
    };
  }

  async findByName(name) {
    return prisma.role.findFirst({ where: { name } });
  }

  async update(id, data) {

    const roleId = Number(id);

    const existingRole = await prisma.role.findUnique({ where: { id: roleId } });

    if (!existingRole) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    const { id: payloadId, permissionKeys, ...roleData } = data;

    await prisma.role.update({ where: { id: roleId }, data: roleData });

    if (Array.isArray(permissionKeys)) {
      await this.setPermissions(roleId, permissionKeys);
    }

    return this.findById(roleId);
  }

  async delete(id) {

    const roleId = Number(id);

    const approvalUsage = await prisma.claimApproval.count({ where: { roleId } });
    if (approvalUsage > 0) {
      throw new Error(
        `Cannot delete this role — it is referenced by ${approvalUsage} claim approval record(s), ` +
        `including historical audit trail. Deactivate or rename the role instead of deleting it.`
      );
    }

    const matrixUsage = await prisma.approvalMatrixApprover.count({ where: { roleId } });
    if (matrixUsage > 0) {
      throw new Error(
        `Cannot delete this role — it is used as an approver step in ${matrixUsage} approval workflow(s). ` +
        `Remove it from those workflows first.`
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.roleCondition.deleteMany({ where: { roleId } });
      await tx.userRole.deleteMany({ where: { roleId } });
      return tx.role.delete({ where: { id: roleId } });
    });
  }

  async getDropdown() {

    const users = await prisma.user.findMany({
      include: { designation: true }
    });

    const uniqueDesignations = [
      ...new Map(
        users
          .filter(u => u.designation)
          .map(u => [u.designation.id, u.designation])
      ).values()
    ];

    return uniqueDesignations.map(designation => ({
      id: designation.id,
      name: designation.name
    }));
  }

  async assignauthorize(roleId, permissionId) {
    return prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId }
    });
  }

  async removeauthorize(roleId, permissionId) {
    return prisma.rolePermission.deleteMany({
      where: { roleId, permissionId }
    });
  }

  async setPermissions(roleId, permissionKeys) {
    return prisma.$transaction(async (tx) => {

      const permissions = await tx.permission.findMany({
        where: { key: { in: permissionKeys } }
      });

      if (permissions.length !== permissionKeys.length) {
        throw new Error("Some permissions not found");
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map(p => ({ roleId, permissionId: p.id }))
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: roleWithPermissions
      });
    });
  }

  async getPermissions(roleId) {
    return prisma.role.findUnique({
      where: { id: roleId },
      include: roleWithPermissions
    });
  }
}

module.exports = new RoleRepository();
