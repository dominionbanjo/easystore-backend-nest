import jwt, { SignOptions } from "jsonwebtoken";
import type ms from "ms";

interface JwtUserPayload {
  userId: string;
  name: string;
  role: string;
  tokenVersion: number;
}

export const createJWT = (payload: JwtUserPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not defined");

  const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as ms.StringValue;

  const options: SignOptions = { expiresIn };

  return jwt.sign(payload, secret, options);
};

export const verifyJWT = (token: string): JwtUserPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not defined");

  const decoded = jwt.verify(token, secret) as JwtUserPayload;
  return decoded;
};
