const roleRepository = require("./role.repository");
const prisma = require("../../prisma/index");

class RoleService {

  async create(data) {

    const { permissionKeys = [], id, ...roleData } = data;

    const role = await roleRepository.create(roleData);

    if (permissionKeys.length) {
      await roleRepository.setPermissions(role.id, permissionKeys);
    }

    return roleRepository.findById(role.id);
  }

  async getDropdown() {
    return roleRepository.getDropdown();
  }

  async addCondition(roleId, condition) {
    return roleRepository.addCondition(roleId, condition);
  }

  async removeCondition(roleId, conditionId) {
    return roleRepository.removeCondition(roleId, conditionId);
  }

  async getEntraRoles({ page = 1, pageSize = 10, departmentId, search, filters }) {

    page = Number(page);
    pageSize = Number(pageSize);

    const users = await prisma.user.findMany({
      where: {
        ...(departmentId ? { departmentId: Number(departmentId) } : {})
      },
      include: {
        designation: true,
        reportsTo: { include: { designation: true } }
      }
    });

    const actualRoles = await prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: true } }
      }
    });

    const roleMap = new Map(
      actualRoles.map(role => [role.name.toLowerCase(), role])
    );

    const uniqueDesignations = [
      ...new Map(
        users
          .filter(u => u.designation)
          .map(u => [u.designation.id, u.designation])
      ).values()
    ];

    const roles = uniqueDesignations.map(designation => {

      const matchedRole = roleMap.get(designation.name.toLowerCase());

      return {
        id: matchedRole?.id ?? null,
        designation: { id: designation.id, name: designation.name },
        permissions: matchedRole?.rolePermissions?.length || 0,
        permissionKeys: matchedRole?.rolePermissions?.map(rp => rp.permission.key) || []
      };
    });

    let filteredRoles = roles;

    if (search) {
      filteredRoles = filteredRoles.filter(role =>
        role.designation.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filters?.['designation.name']) {
      filteredRoles = filteredRoles.filter(role =>
        role.designation.name
          .toLowerCase()
          .includes(filters['designation.name'].toLowerCase())
      );
    }

    const total = filteredRoles.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = filteredRoles.slice(start, end);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  async getAll() {
    return roleRepository.findAll();
  }

  async getById(id) {
    return roleRepository.findById(id);
  }

  async update(id, data) {

    const { permissionKeys, ...roleData } = data;

    const role = await roleRepository.update(id, roleData);

    if (Array.isArray(permissionKeys)) {
      await roleRepository.setPermissions(id, permissionKeys);
    }

    return roleRepository.findById(id);
  }

  async delete(id) {

    const role = await roleRepository.findById(id);

    if (!role) {
      throw new Error("Role not found");
    }

    return roleRepository.delete(id);
  }

  async assignauthorize(roleId, permissionId) {
    return roleRepository.assignauthorize(roleId, permissionId);
  }

  async setPermissions(roleId, permissionKeys) {
    return roleRepository.setPermissions(roleId, permissionKeys);
  }

}

module.exports = new RoleService();
