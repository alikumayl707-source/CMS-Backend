const accessService = require("./access.service");

exports.check = async (req, res, next) => {
  try {

    const {
      userId,
      permissionKey,
      resource
    } = req.body;

    const allowed =
      await accessService.canPerform(
        userId,
        permissionKey,
        resource
      );

    res.json({
      success: true,
      allowed
    });

  } catch (err) {
    next(err);
  }
};