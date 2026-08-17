const service = require("./workflow-dashboard.service");

class WorkflowDashboardController {

async getDashboard(req, res, next) {
  try {

    const page =
      Number(req.query.page) || 1;

    const pageSize =
      Number(req.query.pageSize) || 5;

    const data =
      await service.getDashboard(
        page,
        pageSize
      );

    res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
}


}

module.exports =
  new WorkflowDashboardController();