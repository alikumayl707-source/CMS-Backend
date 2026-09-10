require("dotenv").config();

const { syncFullOrganization } = require("./utils/fullOrgSync");

syncFullOrganization()
  .then((result) => {
    console.log("Full org sync complete:", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Full org sync failed:", err);
    process.exit(1);
  });