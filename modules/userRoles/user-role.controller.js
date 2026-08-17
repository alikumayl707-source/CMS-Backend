const prisma = require("../../prisma/index");

class UserRoleController {


  
  async getAll(req, res, next) {
    try {

      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      const search = req.query.search;

      const where = {
        ...(search
          ? {
              OR: [
                {
                  user: {
                    name: {
                      contains: search
                    }
                  }
                }
              ]
            }
          : {})
      };

      const skip = (page - 1) * pageSize;

   const [rows, total] = await Promise.all([
  prisma.userRole.findMany({
    where,
    skip,
    take: pageSize,
    include: {
      user: true,
      role: true
    },
    orderBy: {
      assignedOn: "desc"
    }
  }),
  prisma.userRole.count({ where })
]);

const data = rows.map(x => ({
  id: x.id,
  userId: x.userId,
  roleId: x.roleId,
  user: x.user?.name,
  role: {
    name: x.role?.name
  },
  assignedOn: x.assignedOn
      ? new Date(x.assignedOn).toLocaleDateString()
      : ''
}));

return res.json({
  success: true,
  data,
  pagination: {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
});

    } catch (error) {
      next(error);
    }
  }
}

module.exports =
  new UserRoleController();