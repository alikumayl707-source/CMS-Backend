const prisma = require("../prisma/index");
const { getGraphToken, findOrCreateDepartment, findOrCreateDesignation } = require("./orgSync");

async function syncFullOrganization() {
  const token = await getGraphToken();

  let url = process.env.MICROSOFT_GRAPH_API;

  const allUsers = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Graph /users failed: ${errBody.error?.message || res.statusText}`);
    }

    const page = await res.json();
    allUsers.push(...(page.value || []));
    url = page["@odata.nextLink"] || null;
  }

  console.log(`Fetched ${allUsers.length} users from Entra`);

  const emailToLocalId = new Map();

  for (const entraUser of allUsers) {
    const email = entraUser.mail || entraUser.userPrincipalName;
    if (!email) continue;

    const department = await findOrCreateDepartment(entraUser.department);
    const designation = await findOrCreateDesignation(entraUser.jobTitle);

    const localUser = await prisma.user.upsert({
      where: { email },
      update: {
        name: entraUser.displayName || email.split("@")[0],
        departmentId: department?.id ?? undefined,
        designationId: designation?.id ?? undefined,
        orgSyncedAt: new Date()
      },
      create: {
        name: entraUser.displayName || email.split("@")[0],
        email,
        password: "ENTRA_LOGIN",
        departmentId: department?.id ?? null,
        designationId: designation?.id ?? null,
        orgSyncedAt: new Date()
      }
    });

    emailToLocalId.set(email.toLowerCase(), localUser.id);
  }

  for (const entraUser of allUsers) {
    const email = entraUser.mail || entraUser.userPrincipalName;
    if (!email) continue;

    const managerEmail = entraUser.manager?.mail || entraUser.manager?.userPrincipalName;
    const userId = emailToLocalId.get(email.toLowerCase());
    const managerId = managerEmail ? emailToLocalId.get(managerEmail.toLowerCase()) : null;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { reportsToId: managerId ?? null }
      });
    }
  }

  return { usersProcessed: allUsers.length };
}

module.exports = { syncFullOrganization };