
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { addons, roomAddons, bookingAddons } from '../models/Addon';

export class AddonService {
  constructor(private fastify: FastifyInstance) {}

  // Create addon
  async createAddon(hotelId: string, addonData: {
    name: string;
    description?: string;
    image?: string;
    price: number;
  }) {
    const db = this.fastify.db;
    
    const newAddon = {
      id: uuidv4(),
      hotelId,
      ...addonData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(addons).values(newAddon);
    
    return await db.query.addons.findFirst({
      where: eq(addons.id, newAddon.id),
    });
  }

  // Get all addons for a hotel
  async getHotelAddons(hotelId: string) {
    const db = this.fastify.db;
    
    return await db.query.addons.findMany({
      where: and(
        eq(addons.hotelId, hotelId),
        eq(addons.status, 'active')
      ),
      orderBy: (addons, { asc }) => [asc(addons.name)],
    });
  }

  // Get single addon
  async getAddonById(hotelId: string, addonId: string) {
    const db = this.fastify.db;
    
    return await db.query.addons.findFirst({
      where: and(
        eq(addons.id, addonId),
        eq(addons.hotelId, hotelId)
      ),
    });
  }

  // Update addon
  async updateAddon(hotelId: string, addonId: string, updateData: {
    name?: string;
    description?: string;
    image?: string;
    price?: number;
    status?: string;
  }) {
    const db = this.fastify.db;
    
    await db.update(addons)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(addons.id, addonId),
        eq(addons.hotelId, hotelId)
      ));

    return await this.getAddonById(hotelId, addonId);
  }

  // Delete addon
  async deleteAddon(hotelId: string, addonId: string) {
    const db = this.fastify.db;
    
    // First remove from room mappings
    await db.delete(roomAddons).where(eq(roomAddons.addonId, addonId));
    
    // Then delete the addon
    await db.delete(addons).where(and(
      eq(addons.id, addonId),
      eq(addons.hotelId, hotelId)
    ));
    
    return { success: true };
  }

  // Update room addons
  async updateRoomAddons(hotelId: string, roomId: string, addonIds: string[]) {
    const db = this.fastify.db;
    
    // Verify all addons belong to the hotel
    const validAddons = await db.query.addons.findMany({
      where: and(
        eq(addons.hotelId, hotelId),
        eq(addons.status, 'active')
      ),
    });
    
    const validAddonIds = validAddons.map(a => a.id);
    const filteredAddonIds = addonIds.filter(id => validAddonIds.includes(id));
    
    // Remove existing mappings
    await db.delete(roomAddons).where(eq(roomAddons.roomId, roomId));
    
    // Add new mappings
    if (filteredAddonIds.length > 0) {
      const mappings = filteredAddonIds.map(addonId => ({
        id: uuidv4(),
        roomId,
        addonId,
        createdAt: new Date(),
      }));
      
      await db.insert(roomAddons).values(mappings);
    }
    
    return { success: true, addedAddons: filteredAddonIds.length };
  }

  // Get room addons
  async getRoomAddons(roomId: string) {
    const db = this.fastify.db;
    
    return await db.query.roomAddons.findMany({
      where: eq(roomAddons.roomId, roomId),
      with: {
        addon: true,
      },
    });
  }

  // Add addons to booking
  async addBookingAddons(bookingId: string, addonSelections: Array<{
    addonId: string;
    quantity: number;
  }>) {
    const db = this.fastify.db;
    
    // Get addon details for pricing
    const addonDetails = await db.query.addons.findMany({
      where: (addons, { inArray }) => inArray(addons.id, addonSelections.map(s => s.addonId)),
    });
    
    const bookingAddonData = addonSelections.map(selection => {
      const addon = addonDetails.find(a => a.id === selection.addonId);
      if (!addon) throw new Error(`Addon ${selection.addonId} not found`);
      
      return {
        id: uuidv4(),
        bookingId,
        addonId: selection.addonId,
        quantity: selection.quantity,
        unitPrice: addon.price,
        totalPrice: addon.price * selection.quantity,
        createdAt: new Date(),
      };
    });
    
    await db.insert(bookingAddons).values(bookingAddonData);
    
    return {
      addons: bookingAddonData,
      totalAddonCost: bookingAddonData.reduce((sum, item) => sum + item.totalPrice, 0),
    };
  }

  // Get booking addons
  async getBookingAddons(bookingId: string) {
    const db = this.fastify.db;
    
    return await db.query.bookingAddons.findMany({
      where: eq(bookingAddons.bookingId, bookingId),
      with: {
        addon: true,
      },
    });
  }
}
