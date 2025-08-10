
// @ts-nocheck
import { FastifyInstance } from "fastify";
import { hotelReviews, bookings, users, hotels } from "../models/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError, ValidationError } from "../types/errors";
import { NotificationService } from "./notification.service";

export class ReviewService {
  private fastify!: FastifyInstance;
  private notificationService = new NotificationService();

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify);
  }

  // Create review with booking validation
  async createReview(userId: string, reviewData: {
    hotelId: string;
    bookingId: string;
    rating: number;
    comment?: string;
  }) {
    const db = this.fastify.db;

    // Validate booking exists and belongs to user
    const booking = await db.select()
      .from(bookings)
      .where(and(
        eq(bookings.id, reviewData.bookingId),
        eq(bookings.userId, userId),
        eq(bookings.hotelId, reviewData.hotelId)
      ))
      .limit(1);

    if (booking.length === 0) {
      throw new ValidationError('Invalid booking. You can only review hotels you have booked.');
    }

    const bookingData = booking[0];

    // Check if booking is completed
    if (bookingData.status !== 'completed') {
      throw new ValidationError('You can only review completed bookings.');
    }

    // Check if user has already reviewed this booking
    const existingReview = await db.select()
      .from(hotelReviews)
      .where(and(
        eq(hotelReviews.bookingId, reviewData.bookingId),
        eq(hotelReviews.userId, userId)
      ))
      .limit(1);

    if (existingReview.length > 0) {
      throw new ValidationError('You have already reviewed this booking.');
    }

    // Validate rating
    if (reviewData.rating < 1 || reviewData.rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5.');
    }

    // Create review
    const reviewId = uuidv4();
    const review = await db.insert(hotelReviews)
      .values({
        id: reviewId,
        userId,
        hotelId: reviewData.hotelId,
        bookingId: reviewData.bookingId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        isVerified: true, // Since it's validated against booking
        isApproved: true,
      })
      .returning();

    // Send notification to hotel about new review
    try {
      await this.notificationService.sendHotelNotification(reviewData.hotelId, {
        title: 'New Review Received',
        message: `New ${reviewData.rating}-star review from a guest`,
        data: { reviewId, bookingId: reviewData.bookingId }
      });
    } catch (error) {
      console.error('Failed to send review notification:', error);
    }

    return review[0];
  }

  // Get user's eligible bookings for reviews
  async getUserEligibleBookingsForReview(userId: string) {
    const db = this.fastify.db;

    const eligibleBookings = await db.select({
      bookingId: bookings.id,
      hotelId: bookings.hotelId,
      hotelName: hotels.name,
      checkInDate: bookings.checkInDate,
      checkOutDate: bookings.checkOutDate,
      status: bookings.status,
    })
    .from(bookings)
    .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
    .leftJoin(hotelReviews, eq(bookings.id, hotelReviews.bookingId))
    .where(and(
      eq(bookings.userId, userId),
      eq(bookings.status, 'completed'),
      eq(hotelReviews.id, null) // No existing review
    ));

    return eligibleBookings;
  }

  // Get review by booking ID
  async getReviewByBookingId(bookingId: string) {
    const db = this.fastify.db;

    const review = await db.select({
      id: hotelReviews.id,
      rating: hotelReviews.rating,
      comment: hotelReviews.comment,
      createdAt: hotelReviews.createdAt,
      userName: users.name,
    })
    .from(hotelReviews)
    .leftJoin(users, eq(hotelReviews.userId, users.id))
    .where(eq(hotelReviews.bookingId, bookingId))
    .limit(1);

    return review[0] || null;
  }
}
