const roleService =
    require("./role.service");

class RoleController {

async getDesignationRoles(req, res, next) {
  try {

    const result =
      await roleService.getEntraRoles({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        departmentId: req.query.departmentId,
        search: req.query.search,
        filters: req.query
      });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    next(error);
  }
}    
async getAll(req, res, next) {
  try {

    const roles =
      await roleService.getAll();

    return res.json({
      success: true,
      data: roles
    });

  } catch (error) {
    next(error);
  }
}
async getDropdown(req, res, next) {
  try {

    const roles =
      await roleService.getDropdown();

    res.json({
      success: true,
      data: roles
    });

  } catch (error) {
    next(error);
  }
}
    async removeCondition (
 req,
 res,
 next
) {
 try {

  const result =
   await roleService.removeCondition(
     req.params.id,
     req.params.conditionId
   );

  res.json(result);

 } catch (err) {
  next(err);
 }
};
async addCondition(
 req,res,next
){
 try{

const result =
 await roleService
 .addCondition(
   Number(req.params.id),
   req.body
 );

 res.json({
   success:true,
   data:result
 });

 }
 catch(err){
   next(err);
 }
}
    async create(req, res, next) {

        try {

            const role =
                await roleService.create(
                    req.body
                );

            return res.status(201).json({
                success: true,
                data: role
            });

        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {

        try {

            const role =
                await roleService.update(
                    Number(req.params.id),
                    req.body
                );

            return res.json({
                success: true,
                data: role
            });

        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {

        try {

            await roleService.delete(
                Number(req.params.id)
            );

            return res.json({
                success: true
            });

        } catch (error) {
            next(error);
        }
    }

async setPermissions(req, res, next) {
    try {

        const roleId = Number(req.params.id);
        const { permissionKeys, designationName } = req.body;

        let role;

        if (!roleId || Number.isNaN(roleId)) {

            if (!designationName) {
                return res.status(400).json({
                    success: false,
                    message: "designationName is required to create a new role mapping"
                });
            }

            role = await roleService.create({
                name: designationName,
                permissionKeys: permissionKeys || []
            });

        } else {

            role = await roleService.setPermissions(
                roleId,
                permissionKeys
            );
        }

        return res.json({ success: true, data: role });

    } catch (error) {
        next(error);
    }
}

}

module.exports = new RoleController();

