const repository =
  require("./designation.repository");

class DesignationService {

  async getAll() {
    return repository.findAll();
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
  new DesignationService();