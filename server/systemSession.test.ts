import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import {
  createSystemSessionToken,
  isSystemSessionCurrent,
  verifySystemSessionToken,
} from "./systemSession";

const secret = "test-only-secret-without-production-value";

describe("system session versioning", () => {
  it("accepts a newly issued token at the current version", () => {
    const token = createSystemSessionToken({ id: 7, sessionVersion: 3 }, secret);
    const payload = verifySystemSessionToken(token, secret);
    expect(payload).toEqual({ id: 7, sessionVersion: 3 });
    expect(isSystemSessionCurrent(payload, { id: 7, sessionVersion: 3 })).toBe(true);
  });

  it("rejects an older token after only that account is revoked", () => {
    const token = createSystemSessionToken({ id: 7, sessionVersion: 2 }, secret);
    const payload = verifySystemSessionToken(token, secret);
    expect(isSystemSessionCurrent(payload, { id: 7, sessionVersion: 3 })).toBe(false);
  });

  it("keeps a legacy token valid for another account still at version zero", () => {
    const legacyToken = jwt.sign({ id: 9 }, secret, { expiresIn: "7d" });
    const payload = verifySystemSessionToken(legacyToken, secret);
    expect(payload).toEqual({ id: 9, sessionVersion: 0 });
    expect(isSystemSessionCurrent(payload, { id: 9, sessionVersion: 0 })).toBe(true);
  });

  it("rejects a legacy token only after its own account version advances", () => {
    const legacyToken = jwt.sign({ id: 7 }, secret, { expiresIn: "7d" });
    const payload = verifySystemSessionToken(legacyToken, secret);
    expect(isSystemSessionCurrent(payload, { id: 7, sessionVersion: 1 })).toBe(false);
    expect(isSystemSessionCurrent(payload, { id: 9, sessionVersion: 0 })).toBe(false);
  });
});
