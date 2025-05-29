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

  },
  hotelAdmin: {
    [permissions.createBooking]: true,
    [permissions.readBooking]: true,
    [permissions.createRoom]: true,
  },
  user: {
    [permissions.viewUserProfile]: true,
    [permissions.updateUserProfile]: true,
  },
};
