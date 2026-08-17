const organizationService =
  require("./organization.service");
const { syncFullOrganization } = require("../../utils/fullOrgSync");

class OrganizationController {

  async getByDepartment(req, res, next) {
    try {
      const data = await organizationService.getByDepartment(req.params.departmentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async syncFullOrg(req, res, next) {
    try {
      const result = await organizationService.syncFullOrg();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateManager(req, res, next) {
    try {
      const result = await organizationService.updateManager(
        Number(req.params.id),
        req.body.managerId
      );
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getHierarchy(req, res, next) {
    try {
      const result = await organizationService.getHierarchy({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        search: req.query.search,
        filters: req.query
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  // FIX: this method previously existed TWICE in the class. The second
  // definition silently overwrote the first (JS classes allow duplicate
  // method names with no warning). The first version read req.body.approvalLimit,
  // the second read req.body.limit — so any client sending `approvalLimit`
  // (the more natural field name) had its value silently dropped, and
  // Number(undefined) = NaN was written to the database.
  // Keeping ONE version, accepting either field name defensively.
  async updateApprovalLimit(req, res, next) {
    try {
      const rawLimit = req.body.approvalLimit ?? req.body.limit;
      const limit = Number(rawLimit);

      if (Number.isNaN(limit)) {
        return res.status(400).json({
          success: false,
          message: "A valid numeric approvalLimit is required"
        });
      }

      const result = await organizationService.updateApprovalLimit(
        Number(req.params.id),
        limit
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async assignManager(req, res, next) {
    try {
      const result = await organizationService.assignManager(
        Number(req.params.id),
        req.body.managerId ? Number(req.body.managerId) : null
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async assignDepartment(req, res, next) {
    try {
      const result = await organizationService.assignDepartment(
        Number(req.params.id),
        Number(req.body.departmentId)
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async assignDesignation(req, res, next) {
    try {
      const result = await organizationService.assignDesignation(
        Number(req.params.id),
        Number(req.body.designationId)
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
async getFullHierarchy(req, res, next) {
  try {
    const data = await organizationService.getFullHierarchy();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
}

module.exports = new OrganizationController();
