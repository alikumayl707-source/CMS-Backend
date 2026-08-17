const repository =
  require("./department.repository");

class DepartmentService {

  async getAll() {
    return repository.findAll();
  }

  async getById(id) {
    return repository.findById(id);
  }

  async create(data) {
    return repository.create(data);
  }

  async update(id, data) {
    return repository.update(id, data);
  }

  async delete(id) {
    return repository.delete(id);
  }

}

module.exports =
  new DepartmentService();