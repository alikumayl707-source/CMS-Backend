const PermissionModel = require("../../model/permission.model");

class PermissionService {
    async create(data) {
        return PermissionModel.create(data);
    }

    async getAll() {
        return PermissionModel.findAll();
    }

    async getByKey(key) {
        return PermissionModel.findByKey(key);
    }

    async update(id, data) {
        return PermissionModel.update(id, data);
    }

    async delete(id) {
        return PermissionModel.delete(id);
    }
}

module.exports = new PermissionService();