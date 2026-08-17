const service =
  require("./designation.service");
  const prisma = require('../../prisma/index')

class DesignationController {
async getByDepartment(req, res) {
  const { departmentId } = req.params;

  const data = await prisma.user.findMany({
    where: {
      departmentId: Number(departmentId)
    },
    include: {
      designation: true
    }
  });

  const designations = [
    ...new Map(
      data
        .filter(x => x.designation)
        .map(x => [x.designation.id, x.designation])
    ).values()
  ];

  res.json(designations);
}
  async getAll(
    req,
    res,
    next
  ) {

    try {

      const data =
        await service.getAll();

      res.json({
        success: true,
        data
      });

    } catch (err) {

      next(err);

    }

  }

  async create(
    req,
    res,
    next
  ) {

    try {

      const data =
        await service.create(
          req.body
        );

      res.status(201).json({
        success: true,
        data
      });

    } catch (err) {

      next(err);

    }

  }

  async update(
    req,
    res,
    next
  ) {

    try {

      const data =
        await service.update(
          Number(req.params.id),
          req.body
        );

      res.json({
        success: true,
        data
      });

    } catch (err) {

      next(err);

    }

  }

  async delete(
    req,
    res,
    next
  ) {

    try {

      await service.delete(
        Number(req.params.id)
      );

      res.json({
        success: true
      });

    } catch (err) {

      next(err);

    }

  }

}

module.exports =
  new DesignationController();