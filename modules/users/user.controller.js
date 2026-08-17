const userService =
    require("./user.service");
const userRepository = require("./user.repository")
class UserController {

    async getAll(req, res, next) {

        try {

            const users = await userService.getAll();

            return res.json({
                success: true,
                data: users
            });

        } catch (error) {
            next(error);
        }
    }
async getCurrentUser(req, res, next) {
  try {
    const user = await userRepository.getPermissions(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const permissionKeys = (user.userRoles || [])
      .flatMap(ur => (ur.role?.rolePermissions || []).map(rp => rp.permission.key));

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        permissionKeys: [...new Set(permissionKeys)]
      }
    });
  } catch (err) {
    next(err);
  }
}
    async getById(req, res, next) {

        try {

            const user = await userService.getById(
                Number(req.params.id)
            );

            return res.json({
                success: true,
                data: user
            });

        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {

        try {

            const user = await userService.create(
                req.body
            );

            return res.status(201).json({
                success: true,
                data: user
            });

        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {

        try {

            const user = await userService.update(
                Number(req.params.id),
                req.body
            );

            return res.json({
                success: true,
                data: user
            });

        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {

        try {

            await userService.delete(
                Number(req.params.id)
            );

            return res.json({
                success: true,
                message: "User deleted"
            });

        } catch (error) {
            next(error);
        }
    }

async removeRole(req, res) {
  try {
    const userId = Number(req.params.id);
    const roleId = Number(req.params.roleId);

    const result =
      await userService.removeRole(
        userId,
        roleId
      );

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
    async assignRole(req, res, next) {

        try {

            const result = await userService.assignRole(
                Number(req.params.id),
                Number(req.body.roleId)
            );

            return res.json({
                success: true,
                data: result
            });

        } catch (error) {
            next(error);
        }
    }

}

module.exports = new UserController();
