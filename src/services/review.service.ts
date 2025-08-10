
import { FastifyInstance } from "fastify";
import { hotelReviews, bookings, users, hotels } from "../models/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError, ValidationError } from "../types/errors";
import { NotificationService } from "./notification.service";
import { formatTimeAgo } from "../utils/helpers";

export class ReviewService {
  private fastify!: FastifyInstance;
  private notificationService = new NotificationService();

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.notificationService.setFastify(fastify);
  }

  // Create review with booking validation
  async createReview(userId: string, reviewData: {
    bookingId: string;
    rating: number;
    comment?: string;
  }) {
    const db = this.fastify.db;

    // Validate booking exists and belongs to user
    const booking = await db.query.bookings.findFirst({

      where: and(
        eq(bookings.id, reviewData.bookingId),
        eq(bookings.userId, userId),
      )
    })


    if (!booking) {
      throw new ValidationError('Invalid booking. You can only review hotels you have booked.');
    }



    // Check if booking is completed
    if (booking.status !== 'completed') {
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
        hotelId: booking.hotelId,
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
  // Get all reviews for a hotel
  async getReviewsByHotelId(hotelId: string) {
    const db = this.fastify.db;

    const reviews = await db.select({
      id: hotelReviews.id,
      userId: hotelReviews.userId,
      rating: hotelReviews.rating,
      comment: hotelReviews.comment,
      bookingId: hotelReviews.bookingId,
      isVerified: hotelReviews.isVerified,
      isApproved: hotelReviews.isApproved,
      createdAt: hotelReviews.createdAt,
      updatedAt: hotelReviews.updatedAt,
      // Guest information from booking
      guestName: bookings.guestName,
      guestEmail: bookings.guestEmail,
      guestPhone: bookings.guestPhone,
    })
      .from(hotelReviews)
      .leftJoin(bookings, eq(hotelReviews.bookingId, bookings.id))
      .where(and(
        eq(hotelReviews.hotelId, hotelId),
        eq(hotelReviews.isApproved, true)
      ))
      .orderBy(desc(hotelReviews.createdAt));

    // Calculate rating statistics
    const totalReviews = reviews.length;
    const overallRating = totalReviews > 0 ?
      reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / totalReviews : null;

    // Rating breakdown (count of each star rating)
    const ratingBreakdown = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    // Transform reviews to match frontend expected format
    const transformedReviews = reviews.map(review => ({
      id: review.id,
      userId: review.userId,
      userName: review.guestName || 'Anonymous Guest',
      userImage: null, // No profile images for booking guests
      rating: review.rating,
      comment: review.comment || '',
      date: review.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
      timeAgo: formatTimeAgo(review.createdAt),
      isVerified: review.isVerified,
      bookingId: review.bookingId,
      guestEmail: review.guestEmail,
      guestPhone: review.guestPhone,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    return {
      overallRating: overallRating ? Math.round(overallRating * 10) / 10 : null,
      totalReviews,
      ratingBreakdown,
      reviews: transformedReviews
    };
  }
  async formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }

  // Get all reviews for a hotel
async getReviewsByHotelId(hotelId: string) {
  const db = this.fastify.db;

  const reviews = await db.select({
    id: hotelReviews.id,
    userId: hotelReviews.userId,
    rating: hotelReviews.rating,
    comment: hotelReviews.comment,
    bookingId: hotelReviews.bookingId,
    isVerified: hotelReviews.isVerified,
    isApproved: hotelReviews.isApproved,
    createdAt: hotelReviews.createdAt,
    updatedAt: hotelReviews.updatedAt,
    // Guest information from booking
    guestName: bookings.guestName,
    guestEmail: bookings.guestEmail,
    guestPhone: bookings.guestPhone,
  })
    .from(hotelReviews)
    .leftJoin(bookings, eq(hotelReviews.bookingId, bookings.id))
    .where(and(
      eq(hotelReviews.hotelId, hotelId),
      eq(hotelReviews.isApproved, true)
    ))
    .orderBy(desc(hotelReviews.createdAt));

  // Calculate rating statistics
  const totalReviews = reviews.length;
  const overallRating = totalReviews > 0 ?
    reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / totalReviews : null;

  // Rating breakdown (count of each star rating)
  const ratingBreakdown = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  };

  // Transform reviews to match frontend expected format
  const transformedReviews = reviews.map(review => ({
    id: review.id,
    userId: review.userId,
    userName: review.guestName || 'Anonymous Guest',
    userImage: null, // No profile images for booking guests
    rating: review.rating,
    comment: review.comment || '',
    date: review.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
    timeAgo: formatTimeAgo(review.createdAt),
    isVerified: review.isVerified,
    bookingId: review.bookingId,
    guestEmail: review.guestEmail,
    guestPhone: review.guestPhone,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }));

  return {
    overallRating: overallRating ? Math.round(overallRating * 10) / 10 : null,
    totalReviews,
    ratingBreakdown,
    reviews: transformedReviews
  };
}

// Get all reviews by a specific user
async getReviewsByUserId(userId: string) {
  const db = this.fastify.db;

  const reviews = await db.select({
    id: hotelReviews.id,
    hotelId: hotelReviews.hotelId,
    userId: hotelReviews.userId,
    rating: hotelReviews.rating,
    comment: hotelReviews.comment,
    bookingId: hotelReviews.bookingId,
    isVerified: hotelReviews.isVerified,
    isApproved: hotelReviews.isApproved,
    createdAt: hotelReviews.createdAt,
    updatedAt: hotelReviews.updatedAt,
    // Guest information from booking
    guestName: bookings.guestName,
    guestEmail: bookings.guestEmail,
    guestPhone: bookings.guestPhone,
    // Hotel information
    hotelName: hotels.name,
    hotelAddress: hotels.address,
    hotelCity: hotels.city
  })
    .from(hotelReviews)
    .leftJoin(bookings, eq(hotelReviews.bookingId, bookings.id))
    .leftJoin(hotels, eq(hotelReviews.hotelId, hotels.id))
    .where(eq(hotelReviews.userId, userId))
    .orderBy(desc(hotelReviews.createdAt));

  // Transform reviews to match frontend expected format
  const transformedReviews = reviews.map(review => ({
    id: review.id,
    hotelId: review.hotelId,
    userId: review.userId,
    userName: review.guestName || 'Anonymous Guest',
    userImage: null,
    rating: review.rating,
    comment: review.comment || '',
    date: review.createdAt.toISOString().split('T')[0],
    timeAgo: formatTimeAgo(review.createdAt),
    isVerified: review.isVerified,
    isApproved: review.isApproved,
    bookingId: review.bookingId,
    guestEmail: review.guestEmail,
    guestPhone: review.guestPhone,
    // Hotel details
    hotelName: review.hotelName,
    hotelAddress: review.hotelAddress,
    hotelCity: review.hotelCity,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }));

  // Calculate user's rating statistics
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ?
    reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / totalReviews : null;

  // Rating breakdown for this user
  const ratingBreakdown = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  };

  // Reviews by status
  const approvedReviews = reviews.filter(r => r.isApproved).length;
  const pendingReviews = reviews.filter(r => !r.isApproved).length;
  const verifiedReviews = reviews.filter(r => r.isVerified).length;

  return {
    totalReviews,
    averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
    approvedReviews,
    pendingReviews,
    verifiedReviews,
    ratingBreakdown,
    reviews: transformedReviews
  };
}



}