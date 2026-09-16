const prisma = require("../../prisma/index");

const DEFAULTS = {
  escalateAfterHours: 48,
  claimantNotifyAfterHours: 72,
  digestReminderAfterHours: 24,
  fallbackApproverUserId: null
};

class EscalationSettingsRepository {

  /*
   * Singleton pattern: Prisma has no native concept of a single-row
   * settings table, so we just always take the first row (ordered by
   * id) and fall back to hardcoded DEFAULTS if none has been created
   * yet — this keeps escalation.service.js / digest.service.js working
   * even before an admin has ever opened the settings panel.
   */
  async get() {
    const settings = await prisma.escalationSettings.findFirst({
      orderBy: { id: "asc" }
    });

    return settings || DEFAULTS;
  }

  async upsert(data, updatedBy) {

    const existing = await prisma.escalationSettings.findFirst({
      orderBy: { id: "asc" }
    });

    if (existing) {
      return prisma.escalationSettings.update({
        where: { id: existing.id },
        data: { ...data, updatedBy }
      });
    }

    return prisma.escalationSettings.create({
      data: { ...data, updatedBy }
    });
  }

  // Feeds the "Escalate to" dropdown in the admin settings panel —
  // same shape as claim.repository.js's findReassignableUsers().
  async findEligibleUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } }
      },
      orderBy: { name: "asc" }
    });
  }

  async findUserById(id) {
    return prisma.user.findUnique({ where: { id: Number(id) } });
  }
}

module.exports = new EscalationSettingsRepository();
