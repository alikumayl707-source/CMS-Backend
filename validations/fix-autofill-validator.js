
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const RISKY_VALIDATOR_TYPES = ["minLength", "maxLength", "pattern"];

function stripRiskyValidators(field, claimTypeCode, changedFlag) {
  if (field.autoFillSource && Array.isArray(field.validators)) {
    const before = field.validators.length;
    field.validators = field.validators.filter(
      (v) => !RISKY_VALIDATOR_TYPES.includes(v.type)
    );
    if (field.validators.length !== before) {
      changedFlag.value = true;
      console.log(
        `[${claimTypeCode}] Cleaned validators on "${field.controlName}" (autoFillSource: ${field.autoFillSource})`
      );
    }
  }

  if (Array.isArray(field.children)) {
    field.children.forEach((child) =>
      stripRiskyValidators(child, claimTypeCode, changedFlag)
    );
  }
}

async function main() {
  const claimTypes = await prisma.claimType.findMany();
  let totalFixed = 0;

  for (const ct of claimTypes) {
    const schema = ct.schema;
    if (!schema || !Array.isArray(schema.rows)) continue;

    const changedFlag = { value: false };
    schema.rows
      .flat()
      .forEach((field) => stripRiskyValidators(field, ct.code, changedFlag));

    if (changedFlag.value) {
      await prisma.claimType.update({
        where: { id: ct.id },
        data: { schema },
      });
      totalFixed++;
    }
  }

  console.log(`Done. Fixed ${totalFixed} claim type schema(s).`);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
