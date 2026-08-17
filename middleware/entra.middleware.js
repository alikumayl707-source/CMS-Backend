const { PrismaClient } = require("@prisma/client");
const { syncFullOrganization } =
  require("../utils/fullOrgSync");
const prisma = new PrismaClient();

module.exports = async (req, res, next) => {

  try {

    const authHeader =
      req.headers.authorization;


    if (!authHeader) {

      return res.status(401).json({
        success: false,
        message: "Token missing"
      });

    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    const payload =
      JSON.parse(
        Buffer.from(
          token.split(".")[1],
          "base64"
        ).toString()
      );



    const email =
      payload.preferred_username ||
      payload.email ||
      payload.upn;

    if (!email) {

      return res.status(401).json({
        success: false,
        message:
          "Email not found in token"
      });

    }

    console.log(
      "ENTRA EMAIL:",
      email
    );

    let user =
      await prisma.user.findUnique({

        where: {
          email
        },

      include: {
  userRoles: {
    include: {
      role: true
    }
  }
}

      });

    if (!user) {

      user =
        await prisma.user.create({

          data: {

            name:
              payload.name ||
              email.split("@")[0],

            email,

            password:
              "ENTRA_LOGIN"

          }

        });
 

    }

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const needsSync =
  !user.orgSyncedAt ||
  (Date.now() - new Date(user.orgSyncedAt).getTime()) > SYNC_INTERVAL_MS;

if (needsSync) {
  try {
    const { syncUserOrgProfile } = require("../utils/orgSync");
    user = await syncUserOrgProfile(user, email);

    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } } }
    });
  } catch (syncErr) {
    console.error("Entra org sync failed:", syncErr);
  }
}

const roles =
 payload.roles || [];
   const groups =
  payload.groups || [];

const mappings =
  await prisma.entraGroupRoleMapping.findMany({

    where:{
      groupId:{
        in: groups
      }
    }

  });

for(const mapping of mappings){

  const exists =
    await prisma.userRole.findFirst({

      where:{
        userId:user.id,
        roleId:mapping.roleId
      }

    });

  if(!exists){

    await prisma.userRole.create({

      data:{
        userId:user.id,
        roleId:mapping.roleId
      }

    });

  }

}

req.user = {
  ...user,
  entraRoles: roles
};


    return next();

  }
  catch (err) {
    next(err);

  }

};