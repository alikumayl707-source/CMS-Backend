// entra-location.controller.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const entraLocationService = require("./entra-location.service");

class EntraLocationController {
  async syncLocation(req, res, next) {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(401).json({ success: false, message: "Could not identify user email from token" });
      }

      const localUser = await prisma.user.findUnique({ where: { email } });
      if (!localUser) {
        return res.status(404).json({ success: false, message: `No local user found for email ${email}` });
      }

      const { officeLocation } = req.body;
      const location = await entraLocationService.syncUserLocation(localUser.id, officeLocation);

      res.json({
        success: true,
        data: location ? { locationId: location.id, locationName: location.name } : null
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EntraLocationController();