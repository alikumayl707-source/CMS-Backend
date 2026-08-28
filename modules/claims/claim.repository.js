const { PrismaClient } = require("@prisma/client");
const fs = require("fs/promises");
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const includeDefault = {

  claimType: true,

  documents: true,

  department: true,

  approvals: {
    include: {
      approver: true,
      role: true
    }
  },

  assignedApprover: {
    select: {
      id: true,
      name: true
    }
  }
};
class ClaimRepository {

    async create(data) {
        
        return prisma.claim.create({
            data,
            include: includeDefault
        });
    }
async findAll({
    status,
    claimTypeId,
    createdBy,
    departmentId,
    page = 1,
    pageSize = 10,
    search,
    ...filters
} = {}) {

const where = {
  ...(status ? { status } : {}),
  ...(claimTypeId ? { claimTypeId } : {}),

  ...(createdBy ? { createdBy } : {}),
  ...(departmentId ? { departmentId } : {}),

 ...(search
  ? {
      OR: [
        { claimNumber: { contains: search } }
      ]
    }
  : {})
};

 
Object.entries(filters).forEach(([key, value]) => {
  if (value === undefined || value === null || value === '') return;
 
  switch (key) {
 
    case 'claimType.code':
      where.claimType = {
        code: {
          contains: value
        }
      };
      break;

 
    case 'claimNumber':
      where.claimNumber = {
        contains: value
      };
      break;
 
    case 'amount': {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        where.amount = { equals: num };
      }
      break;
    }
 
    case 'createdAt':
    case 'createdDate': {
      const start = new Date(value);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        where.createdAt = { gte: start, lte: end };
      }
      break;
    }
 
    default:
      break;
  }
});
 
    page = Number(page);
    pageSize = Number(pageSize);
 
    const skip = (page - 1) * pageSize;
 
const [data, total] = await prisma.$transaction([
  prisma.claim.findMany({
    where,
    include: includeDefault,
    orderBy: {
      createdAt: 'desc'
    },
    skip,
    take: pageSize
  }),
  prisma.claim.count({ where })
]);

const enrichedData = data.map(claim => ({
  ...claim,
 trackingStage:
  claim.status === "APPROVED"
    ? "✅ Claim Approved"

    : claim.status === "REJECTED"
    ? "❌ Claim Rejected"

    : claim.systemStage === "FINANCE"
    ? "💰 Awaiting Finance Approval"

    : claim.systemStage === "HR"
    ? "👥 Awaiting HR Approval"

    : claim.requiredApproverRole
    ? `⏳ Awaiting ${claim.requiredApproverRole}`

    : "⏳ Pending Approval"
}));

return {
  data: enrichedData,
  pagination: {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
};
}

    async findById(id) {
        return prisma.claim.findUnique({
            where: { id },
            include: includeDefault
        });
    }
async findDocument(claimId, documentId) {
    return prisma.claimDocument.findFirst({
        where: {
            id: Number(documentId),
            claimId: Number(claimId)
        }
    });
}

async deleteDocument(documentId) {
    return prisma.claimDocument.delete({
        where: {
            id: Number(documentId)
        }
    });
}
    async findByClaimNumber(claimNumber) {
        return prisma.claim.findUnique({
            where: { claimNumber },
            include: includeDefault
        });
    }

    async findDraftsByUser(userId) {
        return prisma.claim.findMany({
            where: {
                createdBy: userId,
                status: "DRAFT"
            },
            include: includeDefault,
            orderBy: {
                updatedAt: "desc"
            }
        });
    }

    async findPotentialDuplicates({
       
        claimTypeId,
        incidentDate,
        excludeId,
        windowDays = 2
    }) {

        const from = new Date(incidentDate);
        from.setDate(from.getDate() - windowDays);

        const to = new Date(incidentDate);
        to.setDate(to.getDate() + windowDays);

        return prisma.claim.findMany({
            where: {
                claimTypeId,
                status: { not: "DRAFT" },
                incidentDate: {
                    gte: from,
                    lte: to
                },
                ...(excludeId ? { id: { not: excludeId } } : {})
            },
            include: includeDefault
        });
    }

    async findByDedupeHash(dedupeHash, excludeId) {
        return prisma.claim.findFirst({
            where: {
                dedupeHash,
                status: { not: "DRAFT" },
                ...(excludeId ? { id: { not: excludeId } } : {})
            }
        });
    }

    async update(id, data) {
        return prisma.claim.update({
            where: { id },
            data,
            include: includeDefault
        });
    }

    async delete(id) {
        return prisma.claim.delete({
            where: { id }
        });
    }

    async addDocument(data) {
        return prisma.claimDocument.create({
            data
        });
    }

    async getDocuments(claimId) {
        return prisma.claimDocument.findMany({
            where: { claimId },
            orderBy: { createdAt: "desc" }
        });
    }

    async findDocumentById(id) {
        return prisma.claimDocument.findUnique({
            where: { id }
        });
    }

}

module.exports = new ClaimRepository();