// @ts-nocheck
import { FastifyInstance } from "fastify";
import { users } from "../models/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import admin from "../config/firebase/firebase";
import { UserRole, UserStatus } from "../types/common";
import { ConflictError, NotFoundError } from "../types/errors";
import { hotelUsers } from "../models/Hotel";
import { NotFound } from "@aws-sdk/client-s3/dist-types";

interface TokenResponse {
  accessToken: string;
  refreshToken: string;

}

export class AuthService {
  private fastify!: FastifyInstance;

  // Method to set Fastify instance
  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Login or register user with Firebase ID token
  async loginWithFirebase(idToken: string, role: string = "user"): Promise<any> {

    console.log("idToken in start of loginWithFirebase  ", idToken);

    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
    console.log("Full token received:", idToken.length, idToken.slice(0, 50));

    console.log("🔍 Decoded Token Payload: ", payload);

    const decodedToken = await admin.auth().verifyIdToken(idToken);




    console.log("decodedToken ", decodedToken);
    console.log("idToken ", idToken);
    const db = this.fastify.db;

    const userFromFirebase = await admin.auth().getUser(decodedToken.uid);
    console.log("userFromFirebase ", userFromFirebase);
    if (!userFromFirebase) {
      throw new Error("User not found in Firebase");
    }
    console.log("userFromFirebase ", userFromFirebase);
    // Check if user exists
    let user = await db.query.users.findFirst({
      where: and(
        eq(users.phone, decodedToken.phone_number),
        eq(users.role, role)
      ),
    });
    console.log('user from db ', user)
    if (!user && (role === UserRole.SUPER_ADMIN || role === UserRole.HOTEL_ADMIN || role === UserRole.STAFF)) {
      console.log('throwing this')
      throw new NotFoundError("User not found ");

    }

    // If user doesn't exist, create a new user
    if (!user && role === UserRole.USER) {
      const userId = uuidv4();
      const now = new Date();

      // Determine hasOnboarded based on role

      await db.transaction(async (tx) => {
        user = await tx
          .insert(users)
          .values({
            id: userId,
            email: "",
            name: userFromFirebase.displayName || null,
            phone: userFromFirebase.phoneNumber || null,
            role: role as any,
            hasOnboarded: true,
            firebaseUid: decodedToken.uid,
            createdAt: now,
            updatedAt: now,
          })
          .returning();



        if (!user) {
          throw new NotFoundError("User not found ");
        }
        user = user[0]
        await tx.insert(customerProfiles).values({
          id: uuidv4(),
          userId: user.id,
          skippedOnboarding: true,


        })
      })


    }
    console.log('came here ')

    if (!user) {
      throw new Error("User not found ");
    }


    // Get hotel ID if user is hotel admin
    let hotelId = null;
    if (user.role === UserRole.HOTEL_ADMIN) {
      const hotelUser = await db.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, user.id),
      });
      console.log('hotelUser ', hotelUser)
      hotelId = hotelUser?.hotelId || null;
    }
    let email = '';
    let gender = ''
    let name = ''
    if (user.role === UserRole.USER) {
      const profile = await db.query.customerProfiles.findFirst({
        where: eq(customerProfiles.userId, user.id)
      })
      email = profile.email
      gender = profile.gender
      name=profile.fullName
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
        name: name || '',
        phone: user.phone,
        hasOnboarded: user.hasOnboarded,
        createdAt: new Date(user.createdAt).toString() || '',
        updatedAt: new Date(user.updatedAt).toString() || '',
        status: user.status,
        role: user.role,
        hotelId,
        email,
        gender
      }
    };

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
        role: user.role
      },
      {
        expiresIn: "30m",
      }
    );

    const refreshToken = await this.fastify.jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role
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
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    try {
      const decoded = await this.fastify.jwt.verify(refreshToken);
      console.log("decoded in refreshToken ", decoded);

      // Check if user exists
      const user = await this.fastify.db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Get hotel ID if user is hotel admin
      let hotelId = null;
      if (user.role === UserRole.HOTEL_ADMIN) {
        const hotelUser = await this.fastify.db.query.hotelUsers.findFirst({
          where: eq(hotelUsers.userId, user.id),
        });
        hotelId = hotelUser?.hotelId || null;
      }
      const tokens = await this.generateTokens({
        id: user.id,
        phone: user.phone,
        role: user.role,
      });
      console.log("tokens in refreshToken ", tokens);
      return {
        ...tokens,
        user: {
          id: user.id,
          name: user.name || '',
          phone: user.phone,
          hasOnboarded: user.hasOnboarded,
          createdAt: new Date(user.createdAt).toString() || '',
          updatedAt: new Date(user.updatedAt).toString() || '',
          status: user.status,
          role: user.role,
          hotelId
        }
      };
    } catch (error) {
      console.log(error);
      throw new Error("Invalid refresh token ");
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

    // Get hotel ID if user is hotel admin
    let hotelId = null;
    if (user.role === UserRole.HOTEL_ADMIN) {
      const hotelUser = await db.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, userId),
      });
      hotelId = hotelUser?.hotelId || null;
    }
    // Remove sensitive information
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      hotelId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, userRole: string, updateData: any) {
    const db = this.fastify.db;

    // If user is a customer, update both users table and customer_profiles table
    if (userRole === 'user') {
      return await db.transaction(async (tx) => {
        console.log('updateData ',updateData)
        // Update user table if name is provided
        if (updateData.name) {
          await tx
            .update(users)
            .set({
              name: updateData.name,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        }

        // Check if customer profile exists
        const existingProfile = await tx.query.customerProfiles.findFirst({
          where: eq(customerProfiles.userId, userId)
        });
        console.log('existingProfile')

        if (existingProfile) {
          console.log('exists ')
          // Update existing customer profile
          const profileUpdateData: any = {
            updatedAt: new Date(),
          };

          if (updateData.fullName) profileUpdateData.fullName = updateData.fullName;
          if (updateData.email) profileUpdateData.email = updateData.email;
          if (updateData.gender) profileUpdateData.gender = updateData.gender;

          // Handle notification preferences
          if (updateData.bookingUpdates !== undefined) profileUpdateData.bookingUpdatesEnabled = updateData.bookingUpdates;
          if (updateData.checkinReminders !== undefined) profileUpdateData.checkinRemindersEnabled = updateData.checkinReminders;
          if (updateData.securityAlerts !== undefined) profileUpdateData.securityAlertsEnabled = updateData.securityAlerts;
          if (updateData.promotionalOffers !== undefined) profileUpdateData.promotionalOffersEnabled = updateData.promotionalOffers;

          await tx
            .update(customerProfiles)
            .set(profileUpdateData)
            .where(eq(customerProfiles.userId, userId));
          console.log('came here ')
        } else {
          // Create new customer profile
          const { v4: uuidv4 } = await import('uuid');
          await tx.insert(customerProfiles).values({
            id: uuidv4(),
            userId,
            fullName: updateData.fullName || null,
            email: updateData.email || null,
            gender: updateData.gender || null,
            bookingUpdatesEnabled: updateData.bookingUpdates ?? true,
            checkinRemindersEnabled: updateData.checkinReminders ?? true,
            securityAlertsEnabled: updateData.securityAlerts ?? true,
            promotionalOffersEnabled: updateData.promotionalOffers ?? false,
          });
        }

        // Return updated profile with customer profile data
        const updatedUser = await tx.query.users.findFirst({
          where: eq(users.id, userId),
          with: {
            customerProfile: true
          }
        });

        if (updatedUser?.customerProfile) {
          return {
            user: {
              id: updatedUser.id,
              name:  updatedUser.customerProfile.fullName,
              phone: updatedUser.phone,
              role: updatedUser.role,
              status: updatedUser.status,
              hasOnboarded: updatedUser.hasOnboarded,
              createdAt: updatedUser.createdAt,
              updatedAt: updatedUser.updatedAt,
              email: updatedUser.customerProfile.email,
              gender: updatedUser.customerProfile.gender
            }
            
          };
        }

        return { user: updatedUser };
      });
    } else {
      // For non-customer users, update only users table
      await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { user: await this.getUserById(userId) };
    }
  }

  async getAllUsers(page: number, limit: number, role: string) {
    const db = this.fastify.db;
    const allUsers = await db.query.users.findMany({
      where: eq(users.role, role),
      offset: (page - 1) * limit,
      limit: limit,
    });
    return allUsers;
  }

  async getUserById(id: string) {
    const db = this.fastify.db;
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    })
    console.log('user from db ', user)
    if (!user) {
      throw new NotFoundError('User Not Found');
    }
    let hotelId;
    if (user.role === UserRole.HOTEL_ADMIN) {
      const hotelUser = await db.query.hotelUsers.findFirst({
        where: eq(hotelUsers.userId, user.id),
      });
      hotelId = hotelUser?.hotelId || null;
    }
    let email = '';
    let gender = '';
    let name = ''
    if (user.role === UserRole.USER) {
      const profile = await db.query.customerProfiles.findFirst({
        where: eq(customerProfiles.userId, user.id)
      })
      email = profile.email
      gender = profile.gender
      name=profile.fullName
    }
    return {
      id: user.id,
      name: name  || '',
      phone: user.phone,
      hasOnboarded: user.hasOnboarded,
      createdAt: new Date(user.createdAt).toString() || '',
      updatedAt: new Date(user.updatedAt).toString() || '',
      status: user.status,
      role: user.role,
      hotelId,
      email,
      gender

    };
  }

  async addHotelAdmin(name: string, phone: string, email: string) {
    const db = this.fastify.db;

    // Check if hotel admin with this phone already exists
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.phone, `+91${phone}`),
        eq(users.role, UserRole.HOTEL_ADMIN)
      ),
    });

    if (user) {
      console.log("user already exists with this phone number");
      throw new ConflictError("User already exists with this phone number");
    }

    const hotelAdmin = await db.insert(users).values({
      id: uuidv4(),
      email,
      name,
      phone: `+91${phone}`,
      role: UserRole.HOTEL_ADMIN,
      hasOnboarded: true, // Hotel admins are pre-onboarded
      status: UserStatus.ACTIVE,
      firebaseUid: `${phone}_temp_uid`,
    }).returning();
    return hotelAdmin[0];
  }


}
import { users } from "../models/User";
import { customerProfiles } from "../models/CustomerProfile";
import { NotFoundError, UnauthorizedError } from "../types/errors";
import { eq } from "drizzle-orm";