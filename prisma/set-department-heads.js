// // ============================================================================
// // FILE: scripts/set-department-heads.js
// //
// // Run once (and again any time HR/Finance ownership changes):
// //   node scripts/set-department-heads.js anum.abdullah@byd-mega.com muhammad.rauf@byd-mega.com
// //
// // Why this is needed: findSystemDeptHead() in claim-approval.service.js
// // first looks for a user in the HR/Finance department with
// // isDepartmentHead: true. If nobody has that flag, it falls back to
// // whichever Entra-synced user in that department has the lowest id —
// // which may NOT be anum.abdullah or muhammad.rauf. This script pins them
// // down explicitly so the fallback path never has to be relied on.
// //
// // This assumes departments have already been flagged via your existing
// // flagHRFinance script (isHRDept / isFinanceDept). Run that first if you
// // haven't.
// // ============================================================================

// const prisma = require("../prisma/index");

// async function main() {
//   const hrEmail = process.argv[2];
//   const financeEmail = process.argv[3];

//   if (!hrEmail || !financeEmail) {
//     console.error(
//       "Usage: node scripts/set-department-heads.js <hr-head-email> <finance-head-email>"
//     );
//     process.exit(1);
//   }

//   const hrDept = await prisma.department.findFirst({ where: { isHRDept: true } });
//   if (!hrDept) {
//     console.error(
//       "No department is flagged isHRDept: true yet. Run the flagHRFinance script first."
//     );
//     process.exit(1);
//   }

//   const financeDept = await prisma.department.findFirst({ where: { isFinanceDept: true } });
//   if (!financeDept) {
//     console.error(
//       "No department is flagged isFinanceDept: true yet. Run the flagHRFinance script first."
//     );
//     process.exit(1);
//   }

//   const hrUser = await prisma.user.findUnique({ where: { email: hrEmail } });
//   if (!hrUser) {
//     console.error(`User "${hrEmail}" not found. Run a full org sync first so this user exists locally.`);
//     process.exit(1);
//   }
//   if (!hrUser.orgSyncedAt) {
//     console.error(
//       `User "${hrEmail}" exists but has never been Entra-synced (orgSyncedAt is null). ` +
//       `findSystemDeptHead() filters on orgSyncedAt: { not: null }, so this user would be ` +
//       `SKIPPED even with isDepartmentHead set. Sync them first.`
//     );
//     process.exit(1);
//   }
//   if (Number(hrUser.departmentId) !== Number(hrDept.id)) {
//     console.error(
//       `User "${hrEmail}" is not in the department flagged as HR (their department is ` +
//       `${hrUser.departmentId ?? "none"}, HR department is ${hrDept.id}). Fix their department ` +
//       `assignment before running this script — validateActorIsSystemDeptHead() checks this ` +
//       `at approval time and will reject them otherwise.`
//     );
//     process.exit(1);
//   }

//   const financeUser = await prisma.user.findUnique({ where: { email: financeEmail } });
//   if (!financeUser) {
//     console.error(`User "${financeEmail}" not found. Run a full org sync first so this user exists locally.`);
//     process.exit(1);
//   }
//   if (!financeUser.orgSyncedAt) {
//     console.error(
//       `User "${financeEmail}" exists but has never been Entra-synced (orgSyncedAt is null). ` +
//       `They would be SKIPPED by findSystemDeptHead() even with isDepartmentHead set. Sync them first.`
//     );
//     process.exit(1);
//   }
//   if (Number(financeUser.departmentId) !== Number(financeDept.id)) {
//     console.error(
//       `User "${financeEmail}" is not in the department flagged as Finance (their department is ` +
//       `${financeUser.departmentId ?? "none"}, Finance department is ${financeDept.id}). Fix their ` +
//       `department assignment before running this script.`
//     );
//     process.exit(1);
//   }

//   // Unset any existing department head in HR/Finance first, so there's
//   // never more than one — findFirst() in findSystemDeptHead() would just
//   // pick whichever one Prisma happens to return first, which is another
//   // silent-ambiguity risk we don't want.
//   await prisma.user.updateMany({
//     where: { departmentId: hrDept.id, isDepartmentHead: true },
//     data: { isDepartmentHead: false }
//   });

//   await prisma.user.updateMany({
//     where: { departmentId: financeDept.id, isDepartmentHead: true },
//     data: { isDepartmentHead: false }
//   });

//   await prisma.user.update({
//     where: { id: hrUser.id },
//     data: { isDepartmentHead: true }
//   });
//   console.log(`"${hrEmail}" set as HR department head.`);

//   await prisma.user.update({
//     where: { id: financeUser.id },
//     data: { isDepartmentHead: true }
//   });
//   console.log(`"${financeEmail}" set as Finance department head.`);
// }

// main()
//   .then(() => prisma.$disconnect())
//   .catch(async (err) => {
//     console.error(err);
//     await prisma.$disconnect();
//     process.exit(1);
//   });
