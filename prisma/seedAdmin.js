const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_ROLE_NAME = process.env.ADMIN_ROLE_NAME;

async function main() {

  console.log(`Bootstrapping admin role for: ${ADMIN_EMAIL}`);

  const allPermissions = await prisma.permission.findMany();

  if (allPermissions.length === 0) {
    throw new Error(
      "No permissions found in DB. Seed permissions first (permission.seed.js) before running this."
    );
  }

  let adminRole = await prisma.role.findFirst({
    where: { name: ADMIN_ROLE_NAME }
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: ADMIN_ROLE_NAME,
        description: "Full system access — bootstrap admin role"
      }
    });
  } else {
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId: adminRole.id }
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map(p => ({
      roleId: adminRole.id,
      permissionId: p.id
    }))
  });


  let adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL }
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: ADMIN_EMAIL.split("@")[0],
        email: ADMIN_EMAIL,
        password: "ENTRA_LOGIN"
      }
    });
  }

  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  });

  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    });
  }

}

main()
  .catch(e => {
    console.error("❌ Bootstrap failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());