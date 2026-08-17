const permissionService =
    require("./permission.service");

class PermissionController {

    async getAll(req, res, next) {

        try {

            const permissions =
                await permissionService.getAll();

            return res.json({
                success: true,
                data: permissions
            });

        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {

        try {

            const permission =
                await permissionService.create(
                    req.body
                );

            return res.status(201).json({
                success: true,
                data: permission
            });

        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {

        try {

            const permission =
                await permissionService.update(
                    Number(req.params.id),
                    req.body
                );

            return res.json({
                success: true,
                data: permission
            });

        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {

        try {

            await permissionService.delete(
                Number(req.params.id)
            );

            return res.json({
                success: true
            });

        } catch (error) {
            next(error);
        }
    }

}

module.exports = new PermissionController();
