import crypto from "crypto";

const createHash = (string: string): string =>
  crypto.createHash("sha256").update(string).digest("hex");

export default createHash;
