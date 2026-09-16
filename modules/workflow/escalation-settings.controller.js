const service = require("./escalation-settings.service");

class EscalationSettingsController {

  async get(req, res, next) {
    try {
      const settings = await service.get();
      return res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = await service.getEligibleUsers();
      return res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const settings = await service.update(req.body, req.user.id);
      return res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EscalationSettingsController();
