import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-default-key-change-in-prod";
const SALT_ROUNDS = 10;

export interface AuthPayload {
    userId: string;
    username: string;
}

export class AuthService {
    /**
     * Hashes a plain text password.
     */
    static async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Verifies a plain text password against a hash.
     */
    static async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Generates a JWT token for the user.
     */
    static generateToken(payload: AuthPayload): string {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    }

    /**
     * Verifies and decodes a JWT token.
     * Returns null if invalid.
     */
    static verifyToken(token: string): AuthPayload | null {
        try {
            return jwt.verify(token, JWT_SECRET) as AuthPayload;
        } catch (error) {
            return null;
        }
    }
}
