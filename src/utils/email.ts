export function generateBookingConfirmationEmail(bookingData) {
    const {
      bookingId,
      hotel,
      room,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guests,
      totalAmount,
      paymentMode,
      status,
      couponValidation,
      nights
    } = bookingData;
  
    // Format dates
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
  
    const formatTime = (date, time = '3:00 PM') => {
      return `${formatDate(date)} at ${time}`;
    };
  
    // Format currency
    const formatCurrency = (amount) => {
      return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
  
    // Determine status badge
    const getStatusBadge = (status) => {
      const statusMap = {
        'confirmed': { class: 'status-confirmed', text: 'Confirmed' },
        'pending': { class: 'status-pending', text: 'Pending' },
        'cancelled': { class: 'status-cancelled', text: 'Cancelled' }
      };
      return statusMap[status] || statusMap['pending'];
    };
  
    const statusBadge = getStatusBadge(status);
  
    // Calculate room rate
    const roomRate = room.pricePerNight * nights;
    const discountAmount = couponValidation ? couponValidation.discountAmount : 0;
  
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your reservation is confirmed</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cereal:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cereal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            color: #222222;
            background-color: #ffffff;
        }
        
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        
        .header {
            padding: 48px 24px 32px 24px;
            text-align: center;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .logo {
            width: 102px;
            height: 32px;
            background: #ff385c;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
            letter-spacing: -0.5px;
            margin-bottom: 32px;
        }
        
        .header h1 {
            font-size: 32px;
            font-weight: 600;
            color: #222222;
            margin-bottom: 8px;
            line-height: 1.25;
        }
        
        .header p {
            font-size: 18px;
            color: #717171;
            font-weight: 400;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 14px;
            margin-top: 16px;
        }
        
        .status-confirmed {
            background-color: #d1f7c4;
            color: #0f7b0f;
        }
        
        .status-pending {
            background-color: #fef7cd;
            color: #b28900;
        }
        
        .status-cancelled {
            background-color: #ffd6d6;
            color: #c13515;
        }
        
        .content {
            padding: 0 24px;
        }
        
        .booking-details {
            margin: 48px 0;
        }
        
        .trip-card {
            border: 1px solid #dddddd;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 32px;
        }
        
        .trip-card-header {
            padding: 24px;
            background: linear-gradient(135deg, #ff385c 0%, #e61e4d 100%);
            color: white;
        }
        
        .trip-card-header h2 {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .trip-card-header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 400;
        }
        
        .booking-id {
            background: #f7f7f7;
            padding: 16px 24px;
            border-bottom: 1px solid #ebebeb;
            font-size: 14px;
            color: #717171;
        }
        
        .booking-id strong {
            color: #222222;
            font-weight: 600;
        }
        
        .trip-details {
            padding: 32px 24px;
        }
        
        .detail-section {
            margin-bottom: 32px;
        }
        
        .detail-section:last-child {
            margin-bottom: 0;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #222222;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        
        .section-title::before {
            content: '';
            width: 4px;
            height: 16px;
            background: #ff385c;
            border-radius: 2px;
            margin-right: 12px;
        }
        
        .detail-grid {
            display: grid;
            gap: 16px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            font-size: 14px;
            color: #717171;
            font-weight: 400;
            flex: 1;
        }
        
        .detail-value {
            font-size: 14px;
            color: #222222;
            font-weight: 500;
            text-align: right;
            flex: 1;
        }
        
        .price-breakdown {
            background: #f9f9f9;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
        }
        
        .price-breakdown h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #222222;
        }
        
        .price-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .price-row:last-child {
            margin-bottom: 0;
            padding-top: 12px;
            border-top: 1px solid #dddddd;
            font-weight: 600;
            font-size: 16px;
        }
        
        .price-label {
            font-size: 14px;
            color: #717171;
        }
        
        .price-value {
            font-size: 14px;
            color: #222222;
            font-weight: 500;
        }
        
        .total-price {
            color: #222222 !important;
            font-weight: 600 !important;
            font-size: 16px !important;
        }
        
        .discount {
            color: #008a05 !important;
        }
        
        .payment-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            border-radius: 12px;
            margin: 32px 0;
        }
        
        .payment-info h4 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .payment-info p {
            font-size: 14px;
            opacity: 0.9;
            line-height: 1.4;
        }
        
        .cta-section {
            text-align: center;
            margin: 48px 0;
            padding: 32px 0;
            border-top: 1px solid #f0f0f0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .cta-button {
            display: inline-block;
            background: #ff385c;
            color: white;
            padding: 14px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            margin: 0 8px 16px 8px;
        }
        
        .cta-button:hover {
            background: #e61e4d;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 56, 92, 0.3);
        }
        
        .cta-button.secondary {
            background: white;
            color: #222222;
            border: 1px solid #dddddd;
        }
        
        .cta-button.secondary:hover {
            background: #f7f7f7;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .contact-card {
            border: 1px solid #dddddd;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            background: #fafafa;
        }
        
        .contact-card h4 {
            font-size: 16px;
            font-weight: 600;
            color: #222222;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        
        .contact-card h4::before {
            content: '📞';
            margin-right: 8px;
            font-size: 18px;
        }
        
        .contact-info {
            display: grid;
            gap: 8px;
        }
        
        .contact-info p {
            font-size: 14px;
            color: #717171;
        }
        
        .contact-info strong {
            color: #222222;
            font-weight: 500;
        }
        
        .checkin-tips {
            background: #e3f2fd;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
        }
        
        .checkin-tips h4 {
            font-size: 16px;
            font-weight: 600;
            color: #1565c0;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        
        .checkin-tips h4::before {
            content: '💡';
            margin-right: 8px;
            font-size: 18px;
        }
        
        .tips-list {
            list-style: none;
            padding: 0;
        }
        
        .tips-list li {
            font-size: 14px;
            color: #1976d2;
            margin-bottom: 8px;
            padding-left: 20px;
            position: relative;
        }
        
        .tips-list li::before {
            content: '•';
            color: #1565c0;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .footer {
            background: #222222;
            color: #dddddd;
            text-align: center;
            padding: 48px 24px;
            margin-top: 48px;
        }
        
        .footer h3 {
            font-size: 18px;
            font-weight: 600;
            color: white;
            margin-bottom: 8px;
        }
        
        .footer p {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 16px;
        }
        
        .footer .small-text {
            font-size: 12px;
            opacity: 0.7;
            margin-top: 24px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
            }
            
            .header {
                padding: 32px 16px 24px 16px;
            }
            
            .header h1 {
                font-size: 28px;
            }
            
            .content {
                padding: 0 16px;
            }
            
            .trip-card-header,
            .trip-details,
            .price-breakdown,
            .payment-info,
            .contact-card,
            .checkin-tips {
                padding: 20px 16px;
            }
            
            .cta-button {
                display: block;
                margin: 16px 0;
                width: 100%;
                text-align: center;
            }
            
            .detail-row {
                flex-direction: column;
                gap: 4px;
            }
            
            .detail-value {
                text-align: left;
                font-weight: 600;
            }
            
            .footer {
                padding: 32px 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">Bookings</div>
            <h1>You're going to ${hotel.name}!</h1>
            <p>Your reservation is ${status}</p>
            <div class="status-badge ${statusBadge.class}">${statusBadge.text}</div>
        </div>
        
        <!-- Content -->
        <div class="content">
            <!-- Trip Card -->
            <div class="trip-card">
                <div class="trip-card-header">
                    <h2>${hotel.name}</h2>
                    <p>${room.name || room.roomType} • ${guests} ${guests === 1 ? 'guest' : 'guests'}</p>
                </div>
                
                <div class="booking-id">
                    <strong>Confirmation number:</strong> ${bookingId}
                </div>
                
                <div class="trip-details">
                    <!-- Dates Section -->
                    <div class="detail-section">
                        <h3 class="section-title">When</h3>
                        <div class="detail-grid">
                            <div class="detail-row">
                                <span class="detail-label">Check-in</span>
                                <span class="detail-value">${formatTime(checkIn)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Check-out</span>
                                <span class="detail-value">${formatTime(checkOut, '11:00 AM')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Duration</span>
                                <span class="detail-value">${nights} ${nights === 1 ? 'night' : 'nights'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Guest Info -->
                    <div class="detail-section">
                        <h3 class="section-title">Who</h3>
                        <div class="detail-grid">
                            <div class="detail-row">
                                <span class="detail-label">Primary guest</span>
                                <span class="detail-value">${guestName}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Email</span>
                                <span class="detail-value">${guestEmail}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Phone</span>
                                <span class="detail-value">${guestPhone}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Where Section -->
                    <div class="detail-section">
                        <h3 class="section-title">Where</h3>
                        <div class="detail-grid">
                            <div class="detail-row">
                                <span class="detail-label">Hotel</span>
                                <span class="detail-value">${hotel.name}</span>
                            </div>
                            ${hotel.address ? `
                            <div class="detail-row">
                                <span class="detail-label">Address</span>
                                <span class="detail-value">${hotel.address}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Price Breakdown -->
            <div class="price-breakdown">
                <h3>Price details</h3>
                <div class="price-row">
                    <span class="price-label">${formatCurrency(room.pricePerNight)} x ${nights} ${nights === 1 ? 'night' : 'nights'}</span>
                    <span class="price-value">${formatCurrency(roomRate)}</span>
                </div>
                ${discountAmount > 0 ? `
                <div class="price-row">
                    <span class="price-label">Discount applied</span>
                    <span class="price-value discount">-${formatCurrency(discountAmount)}</span>
                </div>
                ` : ''}
                <div class="price-row">
                    <span class="price-label total-price">Total</span>
                    <span class="price-value total-price">${formatCurrency(totalAmount)}</span>
                </div>
            </div>
            
            <!-- Payment Info -->
            <div class="payment-info">
                <h4>Payment method</h4>
                <p>${paymentMode === 'online' ? 'Payment completed online' : 'You can complete payment when you arrive at the hotel. We accept cash and all major credit cards.'}</p>
            </div>
            
            <!-- CTA Buttons -->
            <div class="cta-section">
                <a href="#" class="cta-button">View booking details</a>
                <a href="#" class="cta-button secondary">Get directions</a>
                <a href="#" class="cta-button secondary">Contact hotel</a>
            </div>
            
            <!-- Hotel Contact -->
            ${hotel.phone || hotel.email ? `
            <div class="contact-card">
                <h4>Contact your host</h4>
                <div class="contact-info">
                    ${hotel.phone ? `<p><strong>Phone:</strong> ${hotel.phone}</p>` : ''}
                    ${hotel.email ? `<p><strong>Email:</strong> ${hotel.email}</p>` : ''}
                    ${hotel.website ? `<p><strong>Website:</strong> ${hotel.website}</p>` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Check-in Tips -->
            <div class="checkin-tips">
                <h4>Before you go</h4>
                <ul class="tips-list">
                    <li>Check-in starts at 3:00 PM</li>
                    <li>Bring a government-issued photo ID</li>
                    <li>Show this confirmation on your phone or print it out</li>
                    ${paymentMode === 'offline' ? '<li>Payment can be completed at the hotel during check-in</li>' : ''}
                    <li>Contact the hotel if you'll be arriving late</li>
                </ul>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <h3>Have an amazing trip!</h3>
            <p>We're excited you chose to book with us. If you have any questions about your reservation, we're here to help.</p>
            
            <div class="small-text">
                This is an automated message. Please do not reply to this email.<br>
                For support, contact the hotel directly or visit our help center.
            </div>
        </div>
    </div>
</body>
</html>`;
  
    return html;
}

// Usage example:
/*
const bookingData = {
  bookingId: 'BK001234567',
  hotel: {
    name: 'Grand Plaza Hotel',
    address: '123 Main Street, Downtown, City',
    phone: '+91 11 2345 6789',
    email: 'reservations@grandplaza.com',
    website: 'www.grandplazahotel.com'
  },
  room: {
    name: 'Deluxe Double Room',
    roomType: 'deluxe',
    pricePerNight: 3000
  },
  guestName: 'John Doe',
  guestEmail: 'john.doe@email.com',
  guestPhone: '+91 98765 43210',
  checkIn: new Date('2025-07-21'),
  checkOut: new Date('2025-07-23'),
  guests: 2,
  totalAmount: 6220,
  paymentMode: 'offline',
  status: 'confirmed',
  paymentStatus: 'pending',
  advanceAmount: 2000,
  remainingAmount: 4220,
  couponValidation: {
    discountAmount: 500
  },
  nights: 2
};

const emailHtml = generateBookingConfirmationEmail(bookingData);
*/

module.exports = { generateBookingConfirmationEmail };