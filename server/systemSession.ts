import jwt from "jsonwebtoken";

export const LEGACY_SYSTEM_SESSION_VERSION = 0;
export const SYSTEM_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SystemSessionPayload = {
  id: number;
  sessionVersion: number;
};

export function createSystemSessionToken(
  user: { id: number; sessionVersion: number },
  secret: string,
): string {
  return jwt.sign(
    { id: user.id, sessionVersion: user.sessionVersion },
    secret,
    { expiresIn: "7d" },
  );
}

/** Tokens emitidos antes da migração são tratados como versão zero. */
export function verifySystemSessionToken(token: string, secret: string): SystemSessionPayload {
  const decoded = jwt.verify(token, secret) as {
    id?: unknown;
    sessionVersion?: unknown;
  };
  if (!Number.isInteger(decoded.id) || Number(decoded.id) <= 0) {
    throw new Error("Invalid system session user id");
  }
  const rawVersion = decoded.sessionVersion ?? LEGACY_SYSTEM_SESSION_VERSION;
  if (!Number.isInteger(rawVersion) || Number(rawVersion) < 0) {
    throw new Error("Invalid system session version");
  }
  return {
    id: Number(decoded.id),
    sessionVersion: Number(rawVersion),
  };
}

export function isSystemSessionCurrent(
  payload: SystemSessionPayload,
  user: { id: number; sessionVersion: number },
): boolean {
  return payload.id === user.id && payload.sessionVersion === user.sessionVersion;
}
