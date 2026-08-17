

const prisma = require("../prisma/index"); // uses your shared prisma/index.js singleton

const roles = require("../modules/roles/role.seed");
const permissions = require("../modules/permissions/permission.seed");

async function seedPermissions() {
  console.log(`Seeding ${permissions.length} permissions...`);

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        label: perm.label,
        module: perm.module
      },
      create: {
        key: perm.key,
        label: perm.label,
        module: perm.module
      }
    });
  }

  console.log("Permissions seeded.");
}
async function seedRolePermissions() {

  const claimsAdmin =
    await prisma.role.findFirst({
      where: {
        name: "ClaimsAdmin"
      }
    });

  if (!claimsAdmin) {
    throw new Error(
      "ClaimsAdmin role not found"
    );
  }

  const permissions =
    await prisma.permission.findMany();

  for (const permission of permissions) {

    await prisma.rolePermission.upsert({

      where: {
        roleId_permissionId: {
          roleId: claimsAdmin.id,
          permissionId: permission.id
        }
      },

      update: {},

      create: {
        roleId: claimsAdmin.id,
        permissionId: permission.id
      }

    });

  }

  console.log(
    "Role permissions seeded."
  );
}
async function seedRoles() {
  console.log(`Seeding ${roles.length} roles...`);

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        name: role.name,
        description: role.description ?? null
      }
    });
  }

  console.log("Roles seeded.");
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedRolePermissions();
}

main()
  .then(async () => {
    console.log("Seeding complete.");
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("Seeding failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });