import { FastifyInstance } from "fastify";
import { customerProfiles, users } from "../models/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

interface CustomerProfileData {
  fullName?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dateOfBirth?: Date;
  profileImage?: string;
  
  // Notification preferences
  bookingUpdatesEnabled?: boolean;
  checkinRemindersEnabled?: boolean;
  securityAlertsEnabled?: boolean;
  promotionalOffersEnabled?: boolean;
  
  // Other preferences
  preferredLanguage?: string;
  currency?: string;
}

export class CustomerProfileService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get customer profile
  async getProfile(userId: string) {
    const db = this.fastify.db;
    
    const profile = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
      with: {
        user: {
          columns: {
            id: true,
            phone: true,
            name: true,
            createdAt: true,
          }
        }
      }
    });

    if (!profile) {
      // Create default profile if doesn't exist
      return await this.createProfile(userId, {});
    }

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      email: profile.email,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      profileImage: profile.profileImage,
      phone: profile.user.phone,
      
      // Notification preferences
      notifications: {
        bookingUpdates: profile.bookingUpdatesEnabled,
        checkinReminders: profile.checkinRemindersEnabled,
        securityAlerts: profile.securityAlertsEnabled,
        promotionalOffers: profile.promotionalOffersEnabled,
      },
      
      // Preferences
      preferences: {
        language: profile.preferredLanguage,
        currency: profile.currency,
      },
      
      // Account info
      accountInfo: {
        memberSince: profile.user.createdAt,
        verified: !!profile.email,
      },
      
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  // Create customer profile
  async createProfile(userId: string, data: CustomerProfileData) {
    const db = this.fastify.db;
    const profileId = uuidv4();

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await db.insert(customerProfiles).values({
      id: profileId,
      userId,
      fullName: data.fullName,
      email: data.email,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      profileImage: data.profileImage,
      bookingUpdatesEnabled: data.bookingUpdatesEnabled ?? true,
      checkinRemindersEnabled: data.checkinRemindersEnabled ?? true,
      securityAlertsEnabled: data.securityAlertsEnabled ?? true,
      promotionalOffersEnabled: data.promotionalOffersEnabled ?? false,
      preferredLanguage: data.preferredLanguage || 'en',
      currency: data.currency || 'INR',
    });

    return await this.getProfile(userId);
  }

  // Update customer profile
  async updateProfile(userId: string, data: CustomerProfileData) {
    const db = this.fastify.db;

    // Check if profile exists
    const existingProfile = await db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId)
    });

    if (!existingProfile) {
      // Create if doesn't exist
      return await this.createProfile(userId, data);
    }

    // Update profile
    await db
      .update(customerProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.userId, userId));

    return await this.getProfile(userId);
  }

  // Update notification preferences
  async updateNotificationPreferences(userId: string, preferences: {
    bookingUpdates?: boolean;
    checkinReminders?: boolean;
    securityAlerts?: boolean;
    promotionalOffers?: boolean;
  }) {
    const db = this.fastify.db;

    await db
      .update(customerProfiles)
      .set({
        bookingUpdatesEnabled: preferences.bookingUpdates,
        checkinRemindersEnabled: preferences.checkinReminders,
        securityAlertsEnabled: preferences.securityAlerts,
        promotionalOffersEnabled: preferences.promotionalOffers,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.userId, userId));

    return await this.getProfile(userId);
  }

  // Delete profile
  async deleteProfile(userId: string) {
    const db = this.fastify.db;

    await db
      .delete(customerProfiles)
      .where(eq(customerProfiles.userId, userId));

    return true;
  }
}