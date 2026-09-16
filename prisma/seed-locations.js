

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LOCATIONS = ["Head Office", "Plant", "Dealership"];

async function main() {
  for (const name of LOCATIONS) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    console.log(`✔ ${dept.name} (id: ${dept.id})`);
  }

  console.log("\nDone. These will now appear in the Approval Matrix dialog's");
  console.log("location dropdown. Next: make sure each user's own department");
  console.log("(User.departmentId) points to the correct one of these three —");
  console.log("that's what makes the auto-detect-by-claimant logic work.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
