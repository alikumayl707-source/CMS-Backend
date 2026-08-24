const prisma = require("../../prisma/index");
const organizationRepository = require("./organization.repository");

const MAX_HIERARCHY_DEPTH = 10; 

class OrganizationService {

  async updateManager(employeeId, managerId) {
    return organizationRepository.assignManager(employeeId, managerId);
  }

  async updateApprovalLimit(employeeId, limit) {
    return organizationRepository.updateApprovalLimit(employeeId, limit);
  }

async getHierarchy({
  page = 1,
  pageSize = 10,
  search,
  filters = {}
}) {
  return organizationRepository.getHierarchy({
    page,
    pageSize,
    search,
    filters
  });
}
async getByDepartment(departmentId) {
  return organizationRepository.getByDepartment(departmentId);
}

async syncFullOrg() {
  const { syncFullOrganization } = require("../../utils/fullOrgSync");
  console.log('full ' ,syncFullOrganization)
  return syncFullOrganization();
}
  async assignManager(employeeId, managerId) {
    return organizationRepository.assignManager(employeeId, managerId);
  }

  async assignDepartment(employeeId, departmentId) {
    return organizationRepository.assignDepartment(employeeId, departmentId);
  }

  async assignDesignation(employeeId, designationId) {
    return organizationRepository.assignDesignation(employeeId, designationId);
  }

  async findEligibleApprover(creatorId, requiredRoleName, claimAmount) {

    let currentUserId = creatorId;

    for (let depth = 0; depth < MAX_HIERARCHY_DEPTH; depth++) {

      const current = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: { reportsTo: true }
      });

      if (!current || !current.reportsTo) {
        return null; 
      }

      const manager = await prisma.user.findUnique({
        where: { id: current.reportsTo.id },
        include: {
          designation: true,
          userRoles: { include: { role: true } }
        }
      });

      if (!manager) {
        return null;
      }

      const holdsRequiredRole = manager.userRoles.some(
        ur => ur.role.name === requiredRoleName
      );

      const managerLimit = Number(
        manager.approvalLimit ??
        manager.designation?.defaultApprovalLimit ??
        0
      );

  if (
  holdsRequiredRole &&
  managerLimit >= claimAmount &&
  manager.orgSyncedAt ) {
  return manager;
}

      currentUserId = manager.id;
    }

    return null; 
  }
  async getFullHierarchy() {
  return organizationRepository.getFullHierarchy();
}
}

module.exports = new OrganizationService();