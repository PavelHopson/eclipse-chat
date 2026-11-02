import { test } from "vitest";
import assert from "node:assert/strict";
import { timeReportPeriod, localDateTimeValue, localTimeIso, timeCsvCell, personalTimeCsv } from "../../web/src/lib/personalTimeReport.js";

test("day/week use local calendar boundaries including DST", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const spring = timeReportPeriod("2026-03-08", "day");
    const fall = timeReportPeriod("2026-11-01", "day");
    assert.equal(+new Date(spring.to) - +new Date(spring.from), 23 * 3600000);
    assert.equal(+new Date(fall.to) - +new Date(fall.from), 25 * 3600000);
    const week = timeReportPeriod("2026-03-08", "week");
    assert.equal(new Date(week.from).getDay(), 1);
    assert.equal(+new Date(week.to) - +new Date(week.from), 167 * 3600000);
    assert.equal(localDateTimeValue("2026-03-08T07:12:34Z"), "2026-03-08T03:12:34");
    assert.throws(() => localTimeIso("2026-03-08T02:30:00", "2026-03-08T07:12:34Z"));
    assert.equal(localTimeIso("2026-11-01T01:30:00", "2026-11-01T06:30:00Z"), "2026-11-01T06:30:00Z");
    assert.throws(() => timeReportPeriod("2026-02-31", "day"));
    assert.throws(() => timeReportPeriod("", "week"));
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test("CSV neutralizes formulas and leading control whitespace, quotes data", () => {
  for (const text of ["=1+1", "+cmd", "-cmd", "@SUM(A1)", "  =1", "\t=1", "\n@foo", "\uFEFF+1", "\u0000cmd"]) assert.ok(timeCsvCell(text).startsWith('"\''));
  assert.equal(timeCsvCell('Привет, "мир"\nстрока'), '"Привет, ""мир""\nстрока"');
  assert.equal(timeCsvCell("Обычная задача"), '"Обычная задача"');
});
test("CSV separates original duration and period-clipped duration", () => {
  const csv = personalTimeCsv({ from: "2026-11-02T00:00:00Z", to: "2026-11-03T00:00:00Z", totalDurationMs: 3600000, entries: [{ id: "1", startedAt: "2026-11-01T23:00:00Z", confirmedThrough: "2026-11-02T01:00:00Z", endedAt: "2026-11-02T01:00:00Z", durationMs: 7200000, clippedDurationMs: 3600000, interrupted: true, version: 0, action: { id: "1", title: "=SUM(A1)", serverId: "s" } }] });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('"7200000","2026-11-02T00:00:00.000Z","2026-11-02T01:00:00.000Z","3600000"'));
});
