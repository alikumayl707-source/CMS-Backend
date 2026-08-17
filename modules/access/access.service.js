const userRepository = require("../users/user.repository");
const evaluator = require("./access.evaluator");

class AccessService {

  async canPerform(userId, permissionKey, resource) {

    const user = await userRepository.getPermissions(Number(userId));

    if (!user) {
      return false;
    }

    return this.evaluateUser(user, permissionKey, resource);
  }

  async canPerformWithUser(user, permissionKey, resource) {

    if (!user) {
      return false;
    }

    return this.evaluateUser(user, permissionKey, resource);
  }

  evaluateUser(user, permissionKey, resource) {

    const roles = (user.userRoles || [])
      .filter(ur =>
        (ur.role?.rolePermissions || []).some(
          rp => rp.permission?.key === permissionKey
        )
      );

    if (!roles.length) {
      return false;
    }

    return roles.some(ur => {
      const conditions = ur.role?.roleConditions || [];
      return conditions.every(condition =>
        evaluator.evaluateCondition(condition, user, resource)
      );
    });
  }

}

module.exports = new AccessService();