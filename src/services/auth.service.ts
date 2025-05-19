import { FastifyInstance } from "fastify";
import { users } from "../models/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import admin from "../config/firebase/firebase";

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    name: string | null;
    role: string;
    firebaseUid: string;
    createdAt: string;
    updatedAt: string;
  };
}

export class AuthService {
  private fastify!: FastifyInstance;

  // Method to set Fastify instance
  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Login or register user with Firebase ID token
  async loginWithFirebase(idToken: string): Promise<TokenResponse> {
    try {
      console.log("idToken in start of loginWithFirebase  ", idToken);

      const decodedToken = await admin.auth().verifyIdToken(idToken);

      console.log("decodedToken ", decodedToken);
      console.log("idToken ", idToken);
      const db = this.fastify.db;

      const userFromFirebase = await admin.auth().getUser(decodedToken.uid);

      if (!userFromFirebase) {
        throw new Error("User not found in Firebase");
      }
      console.log("userFromFirebase ", userFromFirebase);
      // Check if user exists
      let user = await db.query.users.findFirst({
        where: eq(users.firebaseUid, decodedToken.uid),
      });

      // If user doesn't exist, create a new user
      if (!user) {
        const userId = uuidv4();
        const now = new Date();

        user = await db
          .insert(users)
          .values({
            id: userId,
            email: "",
            name: userFromFirebase.displayName || null,
            phone: userFromFirebase.phoneNumber || null,
            role: "user",
            firebaseUid: decodedToken.uid,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      }

      if (!user) {
        throw new Error("User not found after creation");
      }

      console.log("user ", user);
      console.log("generating token");
      // Generate JWT tokens
      const tokens = await this.generateTokens(user);

      console.log("tokens ", tokens);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          firebaseUid: user.firebaseUid,
          createdAt: new Date(user.createdAt).toISOString(),
          updatedAt: new Date(user.updatedAt).toISOString(),
        },
      };
    } catch (error) {
      throw new Error("Invalid Firebase ID token " + error);
    }
  }

  // Generate access and refresh tokens
  private async generateTokens(user: {
    id: string;
    phone: string;
    role: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.fastify.jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      {
        expiresIn: "1h",
      }
    );

    const refreshToken = await this.fastify.jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      {
        expiresIn: "7d",
      }
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  // Refresh access token using refresh token
  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = await this.fastify.jwt.verify(refreshToken);

      // Check if user exists
      const user = await this.fastify.db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Generate new tokens
      return this.generateTokens({
        id: user.id,
        phone: user.phone,
        role: user.role,
      });
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  // Get user profile
  async getProfile(userId: string) {
    const db = this.fastify.db;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return null;
    }

    // Remove sensitive information
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // Update user profile
  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const db = this.fastify.db;

    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Get updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!updatedUser) {
      throw new Error("User not found after update");
    }

    // Remove sensitive information
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}
