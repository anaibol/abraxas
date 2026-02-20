import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-default-key-change-in-prod";
const SALT_ROUNDS = 10;

type AuthPayload = {
  userId: string;
  email: string;
  role: string;
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function isAuthPayload(obj: unknown): obj is AuthPayload {
  return (
    typeof obj === "object" && obj !== null && "userId" in obj && "email" in obj && "role" in obj
  );
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (isAuthPayload(decoded)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}
