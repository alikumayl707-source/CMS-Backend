const prisma = require("../prisma/index");
require("dotenv").config();

let secrets = null;

async function getSecrets() {
  if (secrets) return secrets;

  secrets = {
    anthropicKey: process.env.anthropicKey,
    spClientId: process.env.spClientId,
    spClientSec: process.env.spClientSec,
    spTenantId: process.env.spTenantId,
    anthropicUrl: process.env.anthropicAPI,
    docIntelEndpoint:
      process.env.AZURE_DOC_INTEL_ENDPOINT,
    docIntelKey:
      process.env.AZURE_DOC_INTEL_KEY
  };

  return secrets;
}

async function getGraphToken() {
  const {
    spClientId,
    spClientSec,
    spTenantId
  } = await getSecrets();
  console.log(spClientId,spTenantId)
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${spTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: spClientId,
        client_secret: spClientSec,
        scope: "https://graph.microsoft.com/.default"
      })
    }
  );

const data = await tokenRes.json();
console.log("Seceret Keys: ",secrets.spClientId, secrets.spTenantId)
if (!tokenRes.ok) {
  console.error("Graph Token Error:", data);

  throw new Error(
    data.error_description ||
    data.error ||
    "Failed to acquire Graph token"
  );
}

if (!data.access_token) {

  throw new Error("Access token missing");
}

return data.access_token;
}
async function findOrCreateDepartment(name) {
  if (!name) return null;
  return prisma.department.upsert({ where: { name }, update: {}, create: { name } });
}

async function findOrCreateDesignation(name) {
  if (!name) return null;
  return prisma.designation.upsert({ where: { name }, update: {}, create: { name } });
}

async function syncManagerChain(userEmail, localUser, token) {
  const managerRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/manager?$select=displayName,mail,userPrincipalName`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!managerRes.ok) {
    return null;
  }

  const manager = await managerRes.json();
  const managerEmail = manager.mail || manager.userPrincipalName;

  const profileRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${managerEmail}?$select=department,jobTitle`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const profile = profileRes.ok ? await profileRes.json() : {};

  const department = await findOrCreateDepartment(profile.department);
  const designation = await findOrCreateDesignation(profile.jobTitle);

  let managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });

  if (!managerUser) {
    managerUser = await prisma.user.create({
      data: {
        name: manager.displayName || managerEmail.split("@")[0],
        email: managerEmail,
        password: "ENTRA_LOGIN",
        departmentId: department?.id || null,
        designationId: designation?.id || null,
        orgSyncedAt: new Date()   // FIX: mark as synced immediately, not only on personal login
      }
    });
  } else {
    managerUser = await prisma.user.update({
      where: { id: managerUser.id },
      data: {
        departmentId: department?.id || managerUser.departmentId,
        designationId: designation?.id || managerUser.designationId,
        orgSyncedAt: new Date()   // FIX: refresh sync timestamp on every chain walk too
      }
    });
  }

  const nextManagerId = await syncManagerChain(managerEmail, managerUser, token);

  await prisma.user.update({
    where: { id: managerUser.id },
    data: { reportsToId: nextManagerId }
  });

  return managerUser.id;
}

async function syncUserOrgProfile(localUser, email) {

  const token = await getGraphToken();

const payload = JSON.parse(
  Buffer.from(
    token.split(".")[1],
    "base64"
  ).toString()
);

console.log("TOKEN ROLES:", payload.roles);
const profileRes = await fetch(
  `https://graph.microsoft.com/v1.0/users/${email}?$select=department,jobTitle`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

const profile = profileRes.ok
  ? await profileRes.json()
  : {};

console.log("PROFILE:", profile);
console.log("Department:", profile.department);
console.log("Job Title:", profile.jobTitle);
let managerId =
  await syncManagerChain(
    email,
    localUser,
    token
  );
const managerRes = await fetch(
  `https://graph.microsoft.com/v1.0/users/${email}/manager?$select=displayName,mail,userPrincipalName`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

if (managerRes.ok) {
  const manager = await managerRes.json();

  console.log("MANAGER:", manager);

  const managerEmail =
    manager.mail ||
    manager.userPrincipalName;

  console.log("MANAGER EMAIL:", managerEmail);

  let managerUser =
    await prisma.user.findUnique({
      where: {
        email: managerEmail
      }
    });

  if (!managerUser) {
    managerUser = await prisma.user.create({
      data: {
        name:
          manager.displayName ||
          managerEmail.split("@")[0],
        email: managerEmail,
        password: "ENTRA_LOGIN"
      }
    });
  }

  console.log("MANAGER USER:", managerUser);

  managerId = managerUser.id;
}
  const department = await findOrCreateDepartment(profile.department);
  const designation = await findOrCreateDesignation(profile.jobTitle);

  return prisma.user.update({
    where: { id: localUser.id },
    data: {
      departmentId: department?.id ?? localUser.departmentId,
      designationId: designation?.id ?? localUser.designationId,
      reportsToId: managerId ?? localUser.reportsToId,
      orgSyncedAt: new Date() 
    }
  });
 


}
module.exports = {
  syncUserOrgProfile,
  findOrCreateDepartment,
  findOrCreateDesignation,
  getGraphToken
};