const repository =
  require(
    "./approval-matrix.repository"
  );
const ruleEngine =
 require(
   "../workflow/workflow.rule.engine"
 );
class ApprovalMatrixService {

async getAll(
 params
) {

  return repository.getAll(
    params
  );

}
/** Says why no workflow matched, so the admin knows exactly what to fix. */
async explainNoWorkflow(payload) {
  const matrices = await repository.findAllForClaimType(payload.claimType);

  if (!matrices.length) {
    return `No approval workflow exists for claim type ${payload.claimType}.`;
  }

  const amount = Number(payload.amount);

  const reasons = matrices.map(m => {
    const why = [];

    if (m.status === "DRAFT") why.push("it is a draft");
    else if (!m.isActive) why.push("it is inactive");

    if (m.departmentId != null && m.departmentId !== payload.departmentId) {
      why.push(
        `it is for department #${m.departmentId}, but the claim is ` +
        (payload.departmentId ? `from department #${payload.departmentId}` : "not linked to a department")
      );
    }

    if (!Number.isNaN(amount) && (amount < Number(m.minAmount) || amount > Number(m.maxAmount))) {
      why.push(`the claim amount (${amount}) is outside its range ${m.minAmount}-${m.maxAmount}`);
    }

    if (m.rules?.length && !ruleEngine.evaluate(m.rules, payload)) {
      why.push("its rules don't match this claim");
    }

    if (!m.approvers?.length) why.push("it has no approvers");

    return `Workflow #${m.id}${m.workflowName ? ` (${m.workflowName})` : ""}: ` +
      (why.join("; ") || "looks like it should match, check the server logs");
  });

  return `No approval workflow matches this claim. ${reasons.join(" | ")}`;
}
async create(data) {
  return repository.create(data);
}

async determineApprover(amount, claimType, departmentId) {
  return repository.determineApprover(amount, claimType, departmentId);
}
async determineWorkflow(payload){

 const workflows =
   await repository.getMatchingWorkflow(
     payload.claimType,
     payload.departmentId,
     payload.amount 
   );
   let workflow =
      workflows.find(
        x =>
          x.rules?.length > 0 &&
          ruleEngine.evaluate(x.rules, payload)
      );

 if (!workflow) {

   workflow =
     workflows.find(
       x =>
         !x.rules ||
         x.rules.length === 0
     );

 }

 if (!workflow) {
   return null;
 }

 return workflow;
}
}

module.exports =
  new ApprovalMatrixService();