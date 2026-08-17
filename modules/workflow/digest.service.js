const prisma = require("../../prisma/index");
const notificationService = require("./notification.service");
const { sendDigestEmail } = require("../../utils/email.service");

const REMINDER_AFTER_HOURS = 24;

class DigestService {

  async run() {

    const digestMap = new Map();

    await this._collectMatrixItems(digestMap);
    await this._collectBypassItems(digestMap);

    for (const [, entry] of digestMap) {
      await this._sendDigestToUser(entry);
    }

    console.log(`[digest] Sent ${digestMap.size} digest email(s).`);
  }

  async _collectMatrixItems(digestMap) {

    const approvals = await prisma.claimApproval.findMany({
      where: { status: "PENDING" },
      include: {
        claim: true,
        approver: true
      }
    });

    const now = Date.now();

    for (const item of approvals) {

      if (item.claim.currentApprovalSequence !== item.sequence) continue;
      if (!item.approver) continue;

      const ageHours = (now - new Date(item.createdAt).getTime()) / 36e5;
      if (ageHours < REMINDER_AFTER_HOURS) continue;

      this._addToDigest(digestMap, item.approver, {
        claimNumber: item.claim.claimNumber || `#${item.claim.id}`,
        claimId: item.claim.id,
        hoursPending: Math.round(ageHours),
        stageLabel: "Approval"
      });
    }
  }

  async _collectBypassItems(digestMap) {

    const stuckClaims = await prisma.claim.findMany({
      where: {
        status: "PENDING_APPROVAL",
        systemStage: { in: ["HR", "FINANCE"] }
      },
      include: { assignedApprover: true }
    });

    const now = Date.now();

    for (const claim of stuckClaims) {

      if (!claim.assignedApprover) continue;

      const ageHours = (now - new Date(claim.updatedAt).getTime()) / 36e5;
      if (ageHours < REMINDER_AFTER_HOURS) continue;

      this._addToDigest(digestMap, claim.assignedApprover, {
        claimNumber: claim.claimNumber || `#${claim.id}`,
        claimId: claim.id,
        hoursPending: Math.round(ageHours),
        stageLabel: claim.systemStage
      });
    }
  }

  _addToDigest(digestMap, user, item) {

    if (!digestMap.has(user.id)) {
      digestMap.set(user.id, { user, items: [] });
    }

    const entry = digestMap.get(user.id);

    if (!entry.items.some(i => i.claimId === item.claimId)) {
      entry.items.push(item);
    }
  }

  async _sendDigestToUser({ user, items }) {

    if (!items.length) return;

    await notificationService.notifyUser(
      user.id,
      "Daily Reminder: Claims Awaiting Your Approval",
      `You have ${items.length} claim(s) awaiting your approval for 24+ hours.`
    );

    if (!user.email) {
      console.warn(`Digest: user ${user.id} (${user.name}) has no email on file, skipping email.`);
      return;
    }

    try {
      await sendDigestEmail({
        to: user.email,
        approverName: user.name,
        items
      });
    } catch (err) {
      console.error(`Digest email failed for user ${user.id}:`, err);
    }
  }
}

module.exports = new DigestService();
