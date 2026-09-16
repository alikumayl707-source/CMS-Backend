const prisma = require("../../prisma/index");
const notificationService = require("./notification.service");
const escalationSettingsService = require("./escalation-settings.service");
const {
  sendEscalationEmail,
  sendClaimantProgressEmail
} = require("../../utils/email.service");

// Last-resort fallback only — used when the admin hasn't picked a
// fallback approver yet via the Escalation Settings dropdown
// (settings.fallbackApproverUserId is null). Prefer configuring that
// dropdown instead of relying on this env var going forward.
const FALLBACK_ESCALATION_EMAIL =
  process.env.FALLBACK_ESCALATION_EMAIL || "anum.abdullah@byd-mega.com";

class EscalationService {


  async run() {
    const settings = await escalationSettingsService.get();

   await this._handleMatrixApprovals(settings);
   await this._handleBypassStages(settings);
  }


  async _handleMatrixApprovals(settings) {

    const approvals = await prisma.claimApproval.findMany({
      where: { status: "PENDING" },
      include: {
        claim: { include: { claimType: true, creator: true } },
        approver: true,
        role: true
      }
    });

    const now = Date.now();

    for (const item of approvals) {

      if (item.claim.currentApprovalSequence !== item.sequence) continue;

      const ageHours = (now - new Date(item.createdAt).getTime()) / 36e5;

      await this._matrixEscalationCheck(item, ageHours, settings);
      await this._claimantProgressCheck(
        item.claim,
        ageHours,
        `Pending with ${item.approver?.name || item.role?.name || "an approver"}`,
        settings
      );
    }
  }

  async _matrixEscalationCheck(item, ageHours, settings) {

    if (ageHours < settings.escalateAfterHours || item.escalatedAt) return;

    const claimTypeCode = item.claim.claimType?.code;
    if (!claimTypeCode) return;

    const workflow = await prisma.approvalMatrix.findFirst({
      where: { claimType: claimTypeCode, isActive: true },
      include: { escalations: true }
    });

    if (!workflow?.escalations?.length) return;

    const applicable = [...workflow.escalations]
      .filter(e => ageHours >= e.afterHours)
      .sort((a, b) => b.afterHours - a.afterHours)[0];

    if (!applicable) return;

    const targetUser = await prisma.user.findFirst({
      where: { designationId: applicable.targetDesignationId, orgSyncedAt: { not: null } }
    });

    if (!targetUser) {
      console.warn(
        `Escalation: no eligible synced user for designation ${applicable.targetDesignationId} ` +
        `(claim ${item.claimId}). Will retry next run.`
      );
      return;
    }

    await prisma.$transaction([
      prisma.claim.update({
        where: { id: item.claimId },
        data: { assignedApproverId: targetUser.id }
      }),
      prisma.claimApproval.update({
        where: { id: item.id },
        data: { approverId: targetUser.id, escalatedAt: new Date() }
      })
    ]);

    await notificationService.notifyUser(
      targetUser.id,
      "Claim Escalated to You",
      `Claim ${item.claim.claimNumber || item.claim.id} was escalated to you after ${Math.round(ageHours)} hours with no action.`
    );

    if (targetUser.email) {
      try {
        await sendEscalationEmail({
          to: targetUser.email,
          approverName: targetUser.name,
          claimNumber: item.claim.claimNumber,
          claimId: item.claim.id,
          hoursPending: Math.round(ageHours)
        });
      } catch (err) {
        console.error("Matrix escalation email failed:", err);
      }
    }
  }

  // ============================================================
  // Bypass-chain claims (systemStage "HR" / "FINANCE")
  // ============================================================
  async _handleBypassStages(settings) {

    const stuckClaims = await prisma.claim.findMany({
      where: {
        status: "PENDING_APPROVAL",
        systemStage: { in: ["HR", "FINANCE"] }
      },
      include: { claimType: true, creator: true, assignedApprover: true }
    });

    const now = Date.now();

    for (const claim of stuckClaims) {

      const ageHours = (now - new Date(claim.updatedAt).getTime()) / 36e5;

      await this._bypassEscalationCheck(claim, ageHours, settings);
      await this._claimantProgressCheck(
        claim,
        ageHours,
        `Pending with ${claim.systemStage} (${claim.assignedApprover?.name || "unassigned"})`,
        settings
      );
    }
  }

  /*
   * Resolves who bypass-stage escalations go to. Priority:
   *   1. settings.fallbackApproverUserId — the admin-picked dropdown
   *      value (Escalation Settings panel).
   *   2. FALLBACK_ESCALATION_EMAIL env var — only used if the admin
   *      hasn't configured #1 yet.
   */
  async _resolveFallbackApprover(settings) {

    if (settings.fallbackApproverUserId) {
      const user = await prisma.user.findUnique({
        where: { id: settings.fallbackApproverUserId }
      });

      if (user) return user;

      console.warn(
        `Escalation: configured fallbackApproverUserId ${settings.fallbackApproverUserId} ` +
        `no longer exists. Falling back to FALLBACK_ESCALATION_EMAIL.`
      );
    }

    return prisma.user.findUnique({
      where: { email: FALLBACK_ESCALATION_EMAIL }
    });
  }

  async _bypassEscalationCheck(claim, ageHours, settings) {

    if (ageHours < settings.escalateAfterHours || claim.escalatedAt) return;

    const fallbackUser = await this._resolveFallbackApprover(settings);

    if (!fallbackUser) {
      console.error(
        `Escalation: no fallback approver configured. Set one in the ` +
        `Escalation Settings panel, or set FALLBACK_ESCALATION_EMAIL in .env.`
      );
      return;
    }

    await prisma.claim.update({
      where: { id: claim.id },
      data: {
        assignedApproverId: fallbackUser.id,
        escalatedAt: new Date()
      }
    });

    await notificationService.notifyUser(
      fallbackUser.id,
      `Claim Escalated (${claim.systemStage})`,
      `Claim ${claim.claimNumber || claim.id} was escalated to you after ${Math.round(ageHours)} hours with no ${claim.systemStage} action.`
    );

    if (fallbackUser.email) {
      try {
        await sendEscalationEmail({
          to: fallbackUser.email,
          approverName: fallbackUser.name,
          claimNumber: claim.claimNumber,
          claimId: claim.id,
          hoursPending: Math.round(ageHours)
        });
      } catch (err) {
        console.error("Bypass escalation email failed:", err);
      }
    }
  }

  async _claimantProgressCheck(claim, ageHours, stageDescription, settings) {

    if (ageHours < settings.claimantNotifyAfterHours || claim.claimantNotifiedAt) return;

    await prisma.claim.update({
      where: { id: claim.id },
      data: { claimantNotifiedAt: new Date() }
    });

    if (claim.creator?.email) {
      try {
        await sendClaimantProgressEmail({
          to: claim.creator.email,
          employeeName: claim.creator.name,
          claimNumber: claim.claimNumber,
          claimType: claim.claimType?.name || claim.claimType?.code,
          amount: claim.amount,
          stageDescription,
          hoursPending: Math.round(ageHours)
        });
      } catch (err) {
        console.error("Claimant progress email failed:", err);
      }
    }

    if (claim.createdBy) {
      await notificationService.notifyUser(
        claim.createdBy,
        "Your Claim Is Still Being Reviewed",
        `Claim ${claim.claimNumber || claim.id} is taking longer than usual. Current status: ${stageDescription}.`
      );
    }
  }
}

module.exports = new EscalationService();
