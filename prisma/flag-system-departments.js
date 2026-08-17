const prisma = require("../prisma/index");

async function main() {
  const hrName = process.argv[2] || "HR";
  const financeName = process.argv[3] || "Finance";

  const hr = await prisma.department.findUnique({ where: { name: hrName } });
  if (!hr) {
    console.error(`Department "${hrName}" not found. Run full org sync first.`);
    process.exit(1);
  }
  await prisma.department.update({ where: { id: hr.id }, data: { isHRDept: true } });
  console.log(`Flagged "${hrName}" as HR department.`);

  const finance = await prisma.department.findUnique({ where: { name: financeName } });
  if (!finance) {
    console.error(`Department "${financeName}" not found. Run full org sync first.`);
    process.exit(1);
  }
  await prisma.department.update({ where: { id: finance.id }, data: { isFinanceDept: true } });
  console.log(`Flagged "${financeName}" as Finance department.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });