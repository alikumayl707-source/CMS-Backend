const repository = require("./location.repository");
const AppError = require("../../utils/appError");

class LocationService {

  async getAll() {
    return repository.findAll();
  }

  async create(name) {
    if (!name || !name.trim()) {
      throw new AppError("Location name is required", 400);
    }
    return repository.create(name.trim());
  }

  async getDepartments(locationId) {          // NEW
    return repository.findDepartments(locationId);
  }

  async getUsers(locationId, departmentId) {   // MODIFIED
    return repository.findUsers(locationId, departmentId);
  }
}

module.exports = new LocationService();