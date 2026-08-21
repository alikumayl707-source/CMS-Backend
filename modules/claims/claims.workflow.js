const { PrismaClient } = require("@prisma/client");

const approvalMatrixService = require(
  "../approvalMatrix/approval-matrix.service"
);

const organizationService = require(
  "../organization/organization.service"
);

const prisma = new PrismaClient();

const claimApprovalService = require("./claim-approval.service");

class ClaimWorkflow {
async returnForCorrection(
  claim,
  actor,
  comments
) {
  return claimApprovalService
    .returnForCorrection(
      claim,
      actor,
      comments
    );
}

async review(
  claim,
  reviewer
) {

  return prisma.claim.update({
    where: {
      id: claim.id
    },
    data: {
      reviewedBy:
        reviewer.id
    }
  });

}

  submit(claim, actor) {
    claim.createdBy = actor.id;
    claim.status = "PENDING_REVIEW";
    return claim;
  }

async approve(claim, actor, comments, lineItemDecisions) {
  return claimApprovalService.advance(claim, actor, comments, lineItemDecisions);
}
async cancel(
 claim,
 actor
){
 return claimApprovalService
   .cancel(
      claim,
      actor
   );
}
  async reject(claim, actor, comments) {
    return claimApprovalService.reject(claim, actor, comments);
  }

  close(claim, actor) {
    if (claim.createdBy === actor.id) {
      throw new Error("Creator cannot close claim");
    }
  }

  settle(claim, actor) {
    if (claim.createdBy === actor.id) {
      throw new Error("Creator cannot settle claim");
    }
  }
}

module.exports = new ClaimWorkflow();
