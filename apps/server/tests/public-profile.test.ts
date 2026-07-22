import { describe, expect, it } from "vitest";
import { publicViewedProfile } from "../src/routes/users.js";

const user = {
  id: "target-user",
  email: "private@example.test",
  passwordHash: "must-never-leak",
  displayName: "Павел",
  avatar: "/uploads/avatars/a.webp",
  profileBanner: "/uploads/profile-banners/b.webp",
  bio: "Строю системы",
  status: "ONLINE",
  activityText: "В работе",
  activityEmoji: "🛠️",
  quietFrom: "22:00",
  quietTo: "08:00",
  timezone: "Europe/Kaliningrad",
  twoFactorEnabled: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  bannedAt: null,
  profileImages: [
    {
      id: "image-1",
      userId: "target-user",
      url: "/uploads/profile-gallery/c.webp",
      position: 0,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ],
} as Parameters<typeof publicViewedProfile>[0];

describe("publicViewedProfile", () => {
  it("returns presentation data without private account properties", () => {
    const result = publicViewedProfile(user, "viewer-user", {
      role: "DEVELOPER",
      joinedAt: new Date("2026-02-01T00:00:00.000Z"),
      canMessage: true,
    });

    expect(result.displayName).toBe("Павел");
    expect(result.profileImages).toHaveLength(1);
    expect(result.serverContext?.role).toBe("DEVELOPER");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("quietFrom");
    expect(result).not.toHaveProperty("timezone");
    expect(result).not.toHaveProperty("twoFactorEnabled");
  });
});
