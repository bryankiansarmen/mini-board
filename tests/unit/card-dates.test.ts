import { describe, expect, it } from "vitest";
import {
  formatDueDate,
  isOverdue,
  todayIso,
} from "@/lib/cards/dates";

describe("todayIso", () => {
  it("returns today's date in YYYY-MM-DD format", () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    expect(todayIso()).toBe(`${now.getFullYear()}-${month}-${day}`);
  });
});

describe("isOverdue", () => {
  it("returns false for null and future dates", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("returns true for a date strictly before today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const iso = yesterday.toISOString().slice(0, 10);
    expect(isOverdue(iso)).toBe(true);
  });

  it("returns false for today (not yet overdue)", () => {
    expect(isOverdue(todayIso())).toBe(false);
  });
});

describe("formatDueDate", () => {
  it("formats a date in the current year as month + day", () => {
    const currentYear = new Date().getFullYear();
    expect(formatDueDate(`${currentYear}-03-05`)).toBe("Mar 5");
  });

  it("appends the year when the date is in a different year", () => {
    const otherYear = new Date().getFullYear() + 1;
    expect(formatDueDate(`${otherYear}-12-31`)).toBe(`Dec 31 ${otherYear}`);
  });
});