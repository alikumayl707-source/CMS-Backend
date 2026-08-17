const auditService = require("./audit.service");

class AuditController {

  async getAuditLogs(req, res, next) {
    try {

      const page =
        Number(req.query.page) || 1;

      const pageSize =
        Number(req.query.pageSize) || 10;

      const search =
        req.query.search || "";

      const module =
        req.query.module || "";

      const data =
        await auditService.getAuditLogs(
          page,
          pageSize,
          search,
          module
        );

      res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      next(error);
    }
  }

  async getAuditById(req, res, next) {
    try {

      const id =
        Number(req.params.id);

      const data =
        await auditService.getAuditById(id);

      res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();