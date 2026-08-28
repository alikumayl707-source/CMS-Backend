const crypto = require("crypto");
const fs = require("fs/promises");
const claimApprovalService = require('../claims/claim-approval.service')
const claimRepository =
    require("./claim.repository");
const {
  sendClaimSubmittedEmail
} = require("../../utils/email.service");

const prisma =
  require("../../prisma/index");
const claimTypeService =
    require("../claim-types/claimType.service");

const dynamicFormValidator =
    require("../../utils/dynamicFormValidator");

 const approvalMatrixService =
  require("../approvalMatrix/approval-matrix.service");
const AppError = require("../../utils/appError");

class ClaimService {


    dateOnly(value) {
        return new Date(value).toISOString().slice(0, 10);
    }

    computeDedupeHash({claimTypeId, incidentDate }) {

        const raw =
            `${claimTypeId}|${this.dateOnly(incidentDate)}`;

        return crypto
            .createHash("sha256")
            .update(raw)
            .digest("hex");
    }

    async generateClaimNumber() {

        const datePart = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

        for (let attempt = 0; attempt < 5; attempt++) {

            const randomPart = crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase();

            const claimNumber = `CLM-${datePart}-${randomPart}`;

            const existing =
                await claimRepository.findByClaimNumber(claimNumber);

            if (!existing) {
                return claimNumber;
            }
        }

        throw new AppError(
            "Could not generate a unique claim number, please retry",
            500
        );
    }

async getAll(query) {
  const { status, claimTypeId, createdBy, departmentId, search, page, pageSize, ...rest } = query;
  return claimRepository.findAll({
    status, search,
    claimTypeId: claimTypeId ? Number(claimTypeId) : undefined,
    createdBy: createdBy ? Number(createdBy) : undefined,
    departmentId: departmentId ? Number(departmentId) : undefined,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 10,
    ...rest,
  });
}

    async getById(id) {

        const claim = await claimRepository.findById(id);

        if (!claim) {
            throw new AppError("Claim not found", 404);
        }

        return claim;
    }

    async listMyDrafts(userId) {
        return claimRepository.findDraftsByUser(userId);
    }


    async checkDuplicate({ claimTypeId, incidentDate }, excludeId) {

        if ( !claimTypeId || !incidentDate) {
            return {
                hasExactDuplicate: false,
                hasSuspectedDuplicates: false,
                matches: []
            };
        }

        const dedupeHash = this.computeDedupeHash({
            claimTypeId,
            incidentDate
        });

        const exact = await claimRepository.findByDedupeHash(
            dedupeHash,
            excludeId
        );

        const matches = await claimRepository.findPotentialDuplicates({
         
            claimTypeId: Number(claimTypeId),
            incidentDate,
            excludeId
        });

        return {
            hasExactDuplicate: !!exact,
            exactMatch: exact || null,
            hasSuspectedDuplicates: matches.length > 0,
            matches
        };
    }

async resubmitAfterRejection(userId, data) {
    const existingId = Number(data.id);
    const existing = await this.getById(existingId);

    if (existing.status !== "REJECTED") {
        throw new AppError("Only rejected claims can be resubmitted", 400);
    }
    if (existing.createdBy !== userId) {
        throw new AppError("You can only resubmit your own claims", 403);
    }

   
    await claimRepository.update(existingId, {
        status: "DRAFT",
        rejectedBy: null,
        rejectionComments: null,
        currentApprovalSequence: null,
        assignedApproverId: null,
        reviewedBy: null,
        approvedBy: null
    });

    return this.submit(userId, data);
}
async getMyClaims(userId, query) {

    const { status, claimTypeId, search, page, pageSize, ...rest } = query;


    return claimRepository.findAll({
        status,
        search,
        claimTypeId: claimTypeId ? Number(claimTypeId) : undefined,
        createdBy: Number(userId),
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        ...rest,
    });
}
async saveDraft(userId, data) {

    const claimType = await claimTypeService.getByCode(data.claimTypeCode);

    const { valid, errors } = dynamicFormValidator.validate(
        claimType.schema,
        data.formData || {},
        { partial: true }
    );

    if (!valid) {
        throw new AppError("Draft has invalid fields", 400, { errors });
    }

    const resolvedAmount = this.resolveAmount(claimType.schema, data.formData ?? {});

    const payload = {
        claimTypeId: claimType.id,
        
        customerId: data.customerId || null,
        incidentDate: data.incidentDate ? new Date(data.incidentDate) : null,
        formData: data.formData ?? {},
        amount: resolvedAmount,
        status: "DRAFT",
        createdBy: userId,
        departmentId: data.departmentId ?? null,
        requiredApproverRole: data.requiredApproverRole ?? null,
        assignedApproverId: data.assignedApproverId ?? null
    };

    if (data.id) {
        const existing = await claimRepository.findById(Number(data.id));
        if (!existing) throw new AppError("Draft not found", 404);
        if (existing.status !== "DRAFT") {
            throw new AppError("Only claims in DRAFT status can be edited this way", 400);
        }
        return claimRepository.update(existing.id, payload);
    }

    return claimRepository.create(payload);
}

    async deleteDraft(id, userId) {

        const claim = await this.getById(id);

        if (claim.status !== "DRAFT") {
            throw new AppError("Only drafts can be deleted", 400);
        }

        if (claim.createdBy && claim.createdBy !== userId) {
            throw new AppError("You can only delete your own drafts", 403);
        }

        return claimRepository.delete(id);
    }

async downloadDocument(
  claimId,
  documentId
) {

  const document =
    await claimRepository.findDocument(
      claimId,
      documentId
    );

  if (!document) {

    throw new AppError(
      "Document not found",
      404
    );

  }

  return document;

}
async submit(userId, data) {

    const existingId = Number(data.id);
    const existing = await this.getById(existingId);

    if (existing.status !== "DRAFT") {
        throw new AppError("This claim has already been submitted", 400);
    }
    if (existing.createdBy !== userId) {
        throw new AppError("You can only submit your own drafts", 403);
    }

    const claimType = await claimTypeService.getById(existing.claimTypeId);
    if (!claimType.isActive) {
        throw new AppError("Claim type is not active", 400);
    }

    const { valid, errors } = dynamicFormValidator.validate(
        claimType.schema, existing.formData || {}, { partial: false }
    );
    if (!valid) {
        throw new AppError("Claim submission is invalid", 400, { errors });
    }

    const duplicateCheck = await this.checkDuplicate({
       
        claimTypeId: claimType.id,
        incidentDate: existing.incidentDate
    }, existingId);

    if (duplicateCheck.hasExactDuplicate && !data.overrideDuplicateWarning) {
        throw new AppError("A matching claim has already been submitted for this policy and incident", 409, {
            existingClaimNumber: duplicateCheck.exactMatch.claimNumber,
            duplicateCandidates: duplicateCheck.matches
        });
    }

    const dedupeHash = this.computeDedupeHash({
        claimTypeId: claimType.id,
        incidentDate: existing.incidentDate
    });

    const claimNumber = await this.generateClaimNumber();

    const resolvedAmount = this.resolveAmount(claimType.schema, existing.formData ?? {});

    let resolvedWorkflow = null;

    if (!claimType.bypassApprovalChain) {

        const claimDepartmentId = await claimApprovalService.resolveClaimDepartmentId(existing);

        resolvedWorkflow = await approvalMatrixService.determineWorkflow({
            claimType: claimType.code,
            departmentId: claimDepartmentId,
            amount: resolvedAmount,
            ...(existing.formData || {})
        });

        if (!resolvedWorkflow) {
throw new AppError(
  "Approval process is missing. Please configure approvers for this claim.",
  422
);

        }
    }

    const payload = {
        status: "SUBMITTED",
        claimNumber,
        dedupeHash,
        amount: resolvedAmount,
        submittedAt: new Date(),
        approvalMatrixId: resolvedWorkflow?.id ?? null,
        isDuplicateSuspect: duplicateCheck.hasSuspectedDuplicates,
        duplicateOfId: duplicateCheck.matches[0]?.id || null
    };

    let claim = await claimRepository.update(existingId, payload);

    await claimApprovalService.initializeChain(claim, userId, resolvedWorkflow);

    claim = await claimRepository.findById(existingId);

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.email) {
            await sendClaimSubmittedEmail({
                to: user.email,
                employeeName: user.name,
                claimNumber: claim.claimNumber,
                claimType: claimType.name || claimType.code,
                amount: claim.amount
            });
        }
    } catch (emailError) {
        console.error("Claim email failed:", emailError);
    }

    return {
        claim,
        duplicateWarning: duplicateCheck.hasSuspectedDuplicates
            ? "This claim resembles other recent claims on the same policy. It has been flagged for review."
            : null
    };
}
resolveAmount(schema, formData) {
  const source = schema?.amountSource ?? this.detectAmountSourceFallback(schema);

  if (!source?.controlName) {
    return 0;
  }

  if (source.mode === "field") {
    const raw = formData?.[source.controlName];
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (source.mode === "sumArray") {
    const items = formData?.[source.controlName];
    if (!Array.isArray(items)) return 0;

    return items.reduce((sum, item) => {
      const value = Number(item?.[source.sumControlName]);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);
  }

  if (source.mode === "sumGroup") {
    const groupValue = formData?.[source.controlName];
    const value = Number(groupValue?.[source.sumControlName]);
    return Number.isNaN(value) ? 0 : value;
  }

  return 0;
}

detectAmountSourceFallback(schema) {
  const rows = schema?.rows ?? [];
  const allFields = rows.flat();

  const containsAmountField = (field) => {
    if (field.controlName === 'amount') return true;
    return (field.children ?? []).some(containsAmountField);
  };

  const arrayAmount = allFields.find(f => f.type === 'array' && containsAmountField(f));
  if (arrayAmount) {
    return { controlName: arrayAmount.controlName, mode: 'sumArray', sumControlName: 'amount' };
  }

  const groupAmount = allFields.find(f => f.type === 'group' && containsAmountField(f));
  if (groupAmount) {
    return { controlName: groupAmount.controlName, mode: 'sumGroup', sumControlName: 'amount' };
  }

  const scalarAmount = allFields.find(f => f.controlName === 'amount' && f.type !== 'array' && f.type !== 'group');
  if (scalarAmount) {
    return { controlName: 'amount', mode: 'field' };
  }

  return null;
}
async addDocuments(claimId, files, userId, documentTypeId) {
    await this.getById(claimId);
    if (!files || files.length === 0) {
        throw new AppError("No files were uploaded", 400);
    }
    const documents = await Promise.all(
        files.map(file =>
            claimRepository.addDocument({
                claimId,
                fileName: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                filePath: file.path,
                uploadedById: userId,
                documentTypeId: documentTypeId || null  
            })
        )
    );
    return documents;
}
    async deleteDocument(claimId, documentId) {

    await this.getById(claimId);

    const document =
        await claimRepository.findDocument(
            claimId,
            documentId
        );

    if (!document) {
        throw new AppError(
            "Document not found",
            404
        );
    }

    try {

        await fs.unlink(document.filePath);

    } catch (err) {

        // Ignore missing file

    }

    await claimRepository.deleteDocument(
        document.id
    );

    return {
        deleted: true
    };
}
async getDocumentStatus(claimId, documentId) {

    await this.getById(claimId);

    const document =
        await claimRepository.findDocument(
            claimId,
            documentId
        );

    if (!document) {
        throw new AppError(
            "Document not found",
            404
        );
    }

    return {
        id: document.id,
        fileName: document.fileName,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        uploadedAt: document.createdAt,
        status: "UPLOADED"
    };
}
    async getDocuments(claimId) {

        await this.getById(claimId);

        return claimRepository.getDocuments(claimId);
    }

}

module.exports = new ClaimService();
