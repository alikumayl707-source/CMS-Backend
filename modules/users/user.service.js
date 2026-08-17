const userRepository =
    require('./user.repository');

class UserService {

    async create(data) {
        return userRepository.create(data);
    }

    async getAll() {
        return userRepository.findAll();
    }

    async getById(id) {
        return userRepository.findById(id);
    }

    async update(id, data) {
        return userRepository.update(id, data);
    }

    async delete(id) {
        return userRepository.delete(id);
    }

    async assignRole(
        userId,
        roleId
    ) {
        return userRepository.assignRole(
            userId,
            roleId
        );
    }
async removeRole(userId, roleId) {
  return userRepository.removeRole(
    userId,
    roleId
  );
}
}


module.exports = new UserService();