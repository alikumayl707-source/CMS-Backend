const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {

  const claimType = await prisma.claimType.findUnique({
    where: { code: "ASSETCLAIMS" }
  });

  if (!claimType) {
    console.error("ASSETCLAIMS claim type not found");
    return;
  }

  const updatedSchema = {
    ...claimType.schema,
    amountField: "furnitureAmount"   // <-- matches formData key from your payload
  };

  await prisma.claimType.update({
    where: { code: "ASSETCLAIMS" },
    data: { schema: updatedSchema }
  });

  console.log("ASSETCLAIMS schema.amountField set to 'furnitureAmount'");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());