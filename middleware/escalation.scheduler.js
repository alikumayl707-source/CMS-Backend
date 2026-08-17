
const cron = require("node-cron");
const escalationService = require("../modules/workflow/escalation.service")
const digestService = require("../modules/workflow/digest.service");
function startEscalationScheduler() {

  cron.schedule("0 * * * *", async () => {
    console.log("[escalation] Running scheduled check...");
    try {
      await escalationService.run();
      console.log("[escalation] Check complete.");
    } catch (err) {
      console.error("[escalation] Run failed:", err);
    }
  });

  console.log("[escalation] Scheduler started — running hourly.");
}


function startDigestScheduler() {

  cron.schedule("0 8 * * *", async () => {
    console.log("[digest] Running daily digest...");
    try {
      await digestService.run();
      console.log("[digest] Digest complete.");
    } catch (err) {
      console.error("[digest] Run failed:", err);
    }
  });

  console.log("[digest] Scheduler started — running daily at 8:00 AM.");
}


module.exports = { startDigestScheduler,startEscalationScheduler };
