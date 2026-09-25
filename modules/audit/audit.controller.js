const auditService = require("./audit.service");
const AppError = require("../../utils/appError");

const MAX_PAGE_SIZE = 100;

class AuditController {

  async getAuditLogs(req, res, next) {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 10, 1), MAX_PAGE_SIZE);
      const search = String(req.query.search ?? "").trim();

      const filters = {
        action: req.query.action,
        module: req.query.module,
        entity: req.query.entity,
        statusCode: req.query.statusCode,
        success: req.query.success,
        userName: req.query.userName,
        userEmail: req.query.userEmail
      };

      const data = await auditService.getAuditLogs(page, pageSize, search, filters);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAuditById(req, res, next) {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError("Invalid audit log id", 400);
      }

      const data = await auditService.getAuditById(id);

      if (!data) {
        throw new AppError("Audit log not found", 404);
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();