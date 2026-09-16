require("dotenv").config();
const { getGraphToken } = require("./utils/orgSync"); // path adjust karein

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

  const headOfficeLike = allUsers.filter(u => {
    const loc = (u.officeLocation || "").toLowerCase();
    return loc.includes("head") || loc.includes("hq") || loc.includes("office");
  });

  console.log(`Users whose officeLocation LOOKS like Head Office: ${headOfficeLike.length}\n`);

  headOfficeLike.forEach(u => {
    console.log(
      `  ${u.displayName || "(no name)"} | officeLocation: "${u.officeLocation || "(empty)"}" | department: "${u.department || "(empty)"}"`
    );
  });

  console.log("\n--- Full breakdown of ALL officeLocation values ---\n");

  const counts = {};
  for (const u of allUsers) {
    const key = u.officeLocation ? u.officeLocation.trim() : "(empty / not set)";
    if (!counts[key]) counts[key] = { total: 0, withDepartment: 0 };
    counts[key].total++;
    if (u.department) counts[key].withDepartment++;
  }

  Object.entries(counts)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([value, stat]) => {
      console.log(`  "${value}"  ->  ${stat.total} user(s), ${stat.withDepartment} have a department set`);
    });
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});