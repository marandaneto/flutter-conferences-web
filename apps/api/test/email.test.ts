import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "../src/env.js";
import { adminEmailRecipients } from "../src/lib/email.js";
import { insertUser, truncateAll } from "./helpers.js";

describe("adminEmailRecipients", () => {
  let originalFallback: string | undefined;

  beforeEach(async () => {
    await truncateAll();
    originalFallback = env.NOTIFICATION_EMAIL;
  });

  afterEach(() => {
    env.NOTIFICATION_EMAIL = originalFallback;
  });

  it("returns admin emails", async () => {
    await insertUser({
      githubLogin: "a1",
      email: "a1@example.com",
      isAdmin: true,
    });
    await insertUser({
      githubLogin: "a2",
      email: "a2@example.com",
      isAdmin: true,
    });

    const result = (await adminEmailRecipients()).sort();
    expect(result).toEqual(["a1@example.com", "a2@example.com"]);
  });

  it("excludes admins without an email", async () => {
    await insertUser({
      githubLogin: "with-email",
      email: "with@example.com",
      isAdmin: true,
    });
    await insertUser({
      githubLogin: "no-email",
      email: null,
      isAdmin: true,
    });

    expect(await adminEmailRecipients()).toEqual(["with@example.com"]);
  });

  it("excludes non-admin users with email", async () => {
    await insertUser({
      githubLogin: "guest",
      email: "guest@example.com",
      isAdmin: false,
    });
    await insertUser({
      githubLogin: "admin",
      email: "admin@example.com",
      isAdmin: true,
    });

    expect(await adminEmailRecipients()).toEqual(["admin@example.com"]);
  });

  it("falls back to NOTIFICATION_EMAIL when no admin user has an email", async () => {
    env.NOTIFICATION_EMAIL = "fallback@example.com";
    await insertUser({
      githubLogin: "admin-no-email",
      email: null,
      isAdmin: true,
    });

    expect(await adminEmailRecipients()).toEqual(["fallback@example.com"]);
  });

  it("falls back to NOTIFICATION_EMAIL when there are no admin users at all", async () => {
    env.NOTIFICATION_EMAIL = "fallback@example.com";
    expect(await adminEmailRecipients()).toEqual(["fallback@example.com"]);
  });

  it("returns empty when no admins and no fallback is configured", async () => {
    env.NOTIFICATION_EMAIL = undefined;
    expect(await adminEmailRecipients()).toEqual([]);
  });

  it("prefers admin emails over the fallback", async () => {
    env.NOTIFICATION_EMAIL = "fallback@example.com";
    await insertUser({
      githubLogin: "real-admin",
      email: "real@example.com",
      isAdmin: true,
    });

    expect(await adminEmailRecipients()).toEqual(["real@example.com"]);
  });
});
