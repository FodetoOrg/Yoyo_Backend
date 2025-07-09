export const permissions: Record<string, string> = {
  createBooking: "createBooking",
  readBooking: "readBooking",
  viewUserProfile: "viewUserProfile",
  updateUserProfile: "updateUserProfile",
  createHotel: "createHotel",
  updateHotel: "updateHotel",
  deleteHotel: "deleteHotel",
  getHotel: "getHotel",
  createRoom: "createRoom",
  viewAllHotels: "viewAllHotels",
  
  // Room Types
  createRoomType: "createRoomType",
  updateRoomType: "updateRoomType",
  deleteRoomType: "deleteRoomType",
  
  // Coupons
  createCoupon: "createCoupon",
  updateCoupon: "updateCoupon",
  deleteCoupon: "deleteCoupon",
  viewCoupons: "viewCoupons",
  
  // Revenue
  viewRevenue: "viewRevenue",
  manageRevenue: "manageRevenue",
  
  // Pricing
  managePricing: "managePricing",
  
  // Analytics
  viewAnalytics: "viewAnalytics",
  
  // Invoices
  viewInvoices: "viewInvoices",
  manageInvoices: "manageInvoices",


};

export const rolePermissions: Record<string, Record<string, boolean>> = {
  superAdmin: {
    [permissions.createBooking]: true,
    [permissions.readBooking]: true,
    [permissions.createHotel]: true,
    [permissions.updateHotel]: true,
    [permissions.deleteHotel]: true,
    [permissions.createRoom]: true,
    [permissions.viewAllHotels]: true,
    [permissions.createRoomType]: true,
    [permissions.updateRoomType]: true,
    [permissions.deleteRoomType]: true,
    [permissions.createCoupon]: true,
    [permissions.updateCoupon]: true,
    [permissions.deleteCoupon]: true,
    [permissions.viewCoupons]: true,
    [permissions.viewRevenue]: true,
    [permissions.manageRevenue]: true,
    [permissions.managePricing]: true,
    [permissions.viewAnalytics]: true,
    [permissions.viewInvoices]: true,
    [permissions.manageInvoices]: true,

  },
  hotel: {
    [permissions.createBooking]: true,
    [permissions.readBooking]: true,
    [permissions.createRoom]: true,
    [permissions.viewAnalytics]: true,
    [permissions.viewInvoices]: true,
  },
  user: {
    [permissions.viewUserProfile]: true,
    [permissions.updateUserProfile]: true,
  },
};
