const prisma =
  require("../prisma/index");
const accessService =
  require("../modules/access/access.service")

module.exports = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          department: true,
          designation: true,
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                  roleConditions: true
                }
              }
            }
          }
        }
      });

      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

  
const allowed = await accessService.canPerformWithUser(
  user,
  permissionKey,
  req.resource || {}
);

if (!allowed) {
  return res.status(403).json({
    success: false,
    message: "Permission Denied"
  });
}


      const { password, ...safeUser } = user;
      req.user = { ...req.user, ...safeUser };

      next();

    } catch (err) {
      next(err);
    }
  };
};
