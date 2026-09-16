const repository = require("./escalation-settings.repository");
const AppError = require("../../utils/appError");

// Options exposed in the admin dropdown — keep this in sync with the
// Angular ESCALATION_HOUR_OPTIONS list.
const ALLOWED_HOURS = [1, 2, 4, 8, 12, 24, 48, 72, 96, 120, 168];

class EscalationSettingsService {

  async get() {
    return repository.get();
  }

  async getEligibleUsers() {
    return repository.findEligibleUsers();
  }

  async update(data, actorId) {

    const {
      escalateAfterHours,
      claimantNotifyAfterHours,
      digestReminderAfterHours,
      fallbackApproverUserId
    } = data;

    const providedHours = {
      escalateAfterHours,
      claimantNotifyAfterHours,
      digestReminderAfterHours
    };

    for (const [key, value] of Object.entries(providedHours)) {
      if (value == null) continue;
      if (!ALLOWED_HOURS.includes(Number(value))) {
        throw new AppError(
          `${key} must be one of: ${ALLOWED_HOURS.join(", ")}`,
          400
        );
      }
    }

    let resolvedFallbackUserId;

    if (fallbackApproverUserId === null) {
      // Explicit clear — admin picked "— None —".
      resolvedFallbackUserId = null;
    } else if (fallbackApproverUserId != null) {
      const user = await repository.findUserById(fallbackApproverUserId);
      if (!user) {
        throw new AppError("Selected fallback approver was not found", 404);
      }
      resolvedFallbackUserId = user.id;
    }

    return repository.upsert(
      {
        ...(escalateAfterHours != null ? { escalateAfterHours: Number(escalateAfterHours) } : {}),
        ...(claimantNotifyAfterHours != null ? { claimantNotifyAfterHours: Number(claimantNotifyAfterHours) } : {}),
        ...(digestReminderAfterHours != null ? { digestReminderAfterHours: Number(digestReminderAfterHours) } : {}),
        ...(resolvedFallbackUserId !== undefined ? { fallbackApproverUserId: resolvedFallbackUserId } : {})
      },
      actorId
    );
  }
}

module.exports = new EscalationSettingsService();
