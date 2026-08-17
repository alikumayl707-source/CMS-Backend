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