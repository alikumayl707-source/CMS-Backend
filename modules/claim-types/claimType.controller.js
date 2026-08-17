const claimTypeService =
    require("./claimType.service");

class ClaimTypeController {

    async getAll(req, res, next) {

        try {

            const claimTypes =
                await claimTypeService.getAll(req.query);

            return res.json({
                success: true,
                data: claimTypes
            });

        } catch (error) {
            next(error);
        }
    }


    async getByCode(req, res, next) {

        try {

            const claimType =
                await claimTypeService.getByCode(
                    req.params.code
                );

            return res.json({
                success: true,
                data: claimType
            });

        } catch (error) {
            next(error);
        }
    }

async getById(req, res, next) {
  try {
    const claimType =
        await claimTypeService.getById(
            Number(req.params.id)
        );

    return res.json({
        success: true,
        data: claimType
    });

  } catch (error) {
    next(error);
  }
}

    async create(req, res, next) {

        try {

            const claimType =
                await claimTypeService.create(
                    req.body
                );

            return res.status(201).json({
                success: true,
                data: claimType
            });

        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {

        try {

            const claimType =
                await claimTypeService.update(
                    Number(req.params.id),
                    req.body
                );

            return res.json({
                success: true,
                data: claimType
            });

        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {

        try {

            await claimTypeService.delete(
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

module.exports = new ClaimTypeController();
