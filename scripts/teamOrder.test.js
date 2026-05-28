const test = require("node:test");
const assert = require("node:assert/strict");

test("team members are ordered by last name", async () => {
  const { getTeamMembersSortedByLastName, teamMembers } = await import(
    "../src/lib/team.ts"
  );

  assert.deepEqual(
    getTeamMembersSortedByLastName(teamMembers).map((member) => member.name),
    [
      "Hassan Barbir",
      "Catia Cardoso",
      "Lassana Dioum",
      "Sixtine Dumas",
      "Sébastien Gallié",
      "Samuel Halff",
      "Celeste Leal",
      "Rodrigue Sperisen",
      "Anthony Touboul",
    ],
  );
});
