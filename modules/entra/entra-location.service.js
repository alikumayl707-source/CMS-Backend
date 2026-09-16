const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


const OFFICE_LOCATION_ALIASES = {
  "hq": "Head Office",
  "head office": "Head Office",
  "head office - karachi": "Head Office",      // ← 161 users, YEH ASAL FIX HAI
  "18th floor": "Head Office",
  "ho-18th floor": "Head Office",
  "18th floor - reception": "Head Office",

  "gharo plant": "Plant",
  "plant": "Plant",
  "factory": "Plant",

  "dealership": "Dealership",
  "dealer": "Dealership",
  "care center - korangi - karachi": "Dealership",
  "experience center - islamabad": "Dealership",
  "experience center - metropole - karachi": "Dealership",
  "care center - dha lahore": "Dealership",
  "experience center - gulberg lahore": "Dealership",
  "denza - outlet": "Dealership"
};

class EntraLocationService {
async syncUserLocation(userId, officeLocationRaw) {
  if (!officeLocationRaw) return null;

  const key = officeLocationRaw.trim().toLowerCase();
  const mappedName = OFFICE_LOCATION_ALIASES[key] || officeLocationRaw.trim();

  const location = await prisma.location.findFirst({
    where: { name: mappedName }
  });

  if (!location) {
    console.warn(`Entra officeLocation "${officeLocationRaw}" did not match any Location row for user ${userId}`);
    return null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      locationId: location.id,
      orgSyncedAt: new Date()
    }
  });

  return location;
}
}

module.exports = new EntraLocationService();