import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const stored = await hashPassword("geheim");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("geheim", stored)).toBe(true);
    expect(await verifyPassword("Geheim", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("geheim")).not.toBe(await hashPassword("geheim"));
  });

  it.each(["", "plain", "scrypt$1$2$3", "bcrypt$16384$8$1$c2FsdA$aGFzaA"])(
    "rejects malformed stored value %s",
    async (stored) => {
      expect(await verifyPassword("geheim", stored)).toBe(false);
    },
  );
});
