const service =
  require("./department.service");

class DepartmentController {

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
  new DepartmentController();