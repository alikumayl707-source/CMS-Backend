const prisma =
  require("../../prisma/index");

class DashboardService {

  async getMetrics() {

    const [
      pending,
      inProgress,
      completed,
      rejected
    ] = await Promise.all([

      prisma.claim.count({
        where: {
          status:
            "SUBMITTED"
        }
      }),

      prisma.claim.count({
        where: {
          OR: [
            {
              status:
                "PENDING_APPROVAL"
            },
            {
              systemStage:
                "FINANCE"
            }
          ]
        }
      }),

      prisma.claim.count({
        where: {
          status:
            "APPROVED"
        }
      }),

      prisma.claim.count({
        where: {
          status:
            "REJECTED"
        }
      })

    ]);

    return {

      pending,

      inProgress,

      completed,

      rejected

    };
  }
}

module.exports =
  new DashboardService();