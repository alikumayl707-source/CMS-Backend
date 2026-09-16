const service = require("./location.service");

class LocationController {

  async getAll(req, res, next) {
    try {
      const locations = await service.getAll();
      return res.json({ success: true, data: locations });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const location = await service.create(req.body.name);
      return res.status(201).json({ success: true, data: location });
    } catch (err) {
      next(err);
    }
  }

  async getDepartments(req, res, next) {       // NEW
    try {
      const departments = await service.getDepartments(req.params.id);
      return res.json({ success: true, data: departments });
    } catch (err) {
      next(err);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = await service.getUsers(req.params.id, req.query.departmentId);  // MODIFIED
      return res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();