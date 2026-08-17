// modules/workflow/claim-history.service.js

const prisma = require("../../prisma/index");

class ClaimHistoryService {
  async add({
    claimApprovalId,
    actorId,
    action,
    comments
  }) {
    return prisma.claimApprovalHistory.create({
      data: {
        claimApprovalId,
        actorId,
        action,
        comments
      }
    });
  }
}

module.exports = new ClaimHistoryService();