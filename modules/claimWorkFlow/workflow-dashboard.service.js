const repository =
  require("./workflow-dashboard.repository");

class WorkflowDashboardService {

 async getDashboard(
  page,
  pageSize
) {
  return repository.getDashboard(
    page,
    pageSize
  );
}

  getWorkflowById(id) {
    return repository.getWorkflowById(id);
  }

  getWorkflowClaims(id) {
    return repository.getWorkflowClaims(id);
  }

  getClaimWorkflow(claimId) {
    return repository.getClaimWorkflow(claimId);
  }
}

module.exports =
  new WorkflowDashboardService();
