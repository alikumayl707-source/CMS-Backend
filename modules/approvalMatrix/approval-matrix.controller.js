const service =
 require(
  "./approval-matrix.service"
 );
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
class ApprovalMatrixController {
async getAll(
 req,
 res,
 next
) {

 try {

  const page =
    Number(req.query.page || 1);

  const pageSize =
    Number(req.query.pageSize || 10);

const result =
  await service.getAll({

    page,

    pageSize,

    search:
      req.query.search,

    claimType:
      req.query.claimType,

    departmentId:
      req.query.departmentId,

    workflowName:
      req.query.workflowName,

    status:
      req.query.status

  });
result.data = result.data.map(item => ({
  ...item,

  approverRole:
    item.approvers?.length
      ? item.approvers
          .map(a =>
            a.role?.name ||
            a.specificUser?.designation?.name ||
            a.specificUser?.name
          )
          .filter(Boolean)
          .join(' -> ')
      : 'Not Submitted Yet'
}));
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });

 } catch(err) {

  next(err);

 }

}

async create(req, res, next) {
  try {
const vendorWorkflowClaimTypes =
  (process.env.VENDOR_WORKFLOW_CLAIM_TYPES || '')
    .split(',')
    .map(x => x.trim().toUpperCase())
    .filter(Boolean);
    const {
      claimType,
      departmentId,
      minAmount,
      maxAmount,
      approverUserIds,
      approvalPattern,
      rules,
      vendorEmail,
      escalations,
      isActive,
      approvalCommentRequired,
      rejectionCommentRequired
    } = req.body;

    if (
      !claimType ||
      minAmount == null ||
      maxAmount == null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "claimType, minAmount, maxAmount are required"
      });
    }



const claimTypeRecord =
  await prisma.claimType.findUnique({
    where: {
      code: claimType
    }
  });

const isVendorWorkflow =
  vendorWorkflowClaimTypes.includes(
    claimType?.toUpperCase()
  );


  

const requiresApprovalChain =
  !claimTypeRecord?.bypassApprovalChain &&
  !isVendorWorkflow;

if (
  requiresApprovalChain &&
  (
    !Array.isArray(approverUserIds) ||
    approverUserIds.length === 0
  )
) {
  return res.status(400).json({
    success: false,
    message:
      "At least one approver is required"
  });
}

    if (
      Number(maxAmount) <=
      Number(minAmount)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "maxAmount must exceed minAmount"
      });
    }

    const data =
      await service.create({
        claimType,

        departmentId:
          departmentId
            ? Number(departmentId)
            : null,

        minAmount:
          Number(minAmount),

        maxAmount:
          Number(maxAmount),

       approverUserIds:
  Array.isArray(approverUserIds)
    ? approverUserIds.map(Number)
    : [],
        vendorEmail,

        approvalPattern,

        rules:
          rules || [],

        escalations:
          escalations || [],

        isActive:
          isActive ?? true,

        approvalCommentRequired:
          approvalCommentRequired ??
          false,

        rejectionCommentRequired:
          rejectionCommentRequired ??
          true
      });

    return res.status(201).json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
}
 async determineApprover(
  req,
  res,
  next
 ) {

  try {

   const approver =
    await service
      .determineApprover(
        Number(
          req.body.amount
        ),
        req.body.claimType,
        req.body.departmentId
      );

   res.json({
    success:true,
    data:approver
   });

  } catch(err) {

   next(err);

  }

 }

}

module.exports =
 new ApprovalMatrixController();