require("dotenv").config();
const { getGraphToken } = require("./utils/orgSync"); // path apne project ke hisaab se adjust karein

async function main() {
  const token = await getGraphToken();

  let url = process.env.MICROSOFT_GRAPH_API;
  const allUsers = [];

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Graph /users failed: ${errBody.error?.message || res.statusText}`);
    }

    const page = await res.json();
    allUsers.push(...(page.value || []));
    url = page["@odata.nextLink"] || null;
  }

  console.log(`\nTotal users fetched from Entra: ${allUsers.length}\n`);

  const counts = {};
  for (const u of allUsers) {
    const key = u.officeLocation ? u.officeLocation.trim() : "(empty / not set)";
    counts[key] = (counts[key] || 0) + 1;
  }

  console.log("Distinct 'officeLocation' values in Entra (raw text -> how many users have it):\n");

  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([value, count]) => {
      console.log(`  "${value}"  ->  ${count} user(s)`);
    });

  console.log("\nCompare this list against OFFICE_LOCATION_ALIASES in utils/orgSync.js —");
  console.log("any Head Office variant not covered there means those users will");
  console.log("never get matched to the Head Office Location row.\n");
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});