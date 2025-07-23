
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { addons, roomAddons, bookingAddons } from '../models/Addon';
import { rooms } from '../models/Room';
import { uploadToS3 } from '../config/aws';
import { ConflictError, NotFoundError } from '../types/errors';

export class AddonService {
  constructor(private fastify: FastifyInstance) { }

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;

  }

  // Create addon
  async createAddon(hotelId: string, addonData: {
    name: string;
    description?: string;
    image?: string;
    price: number;
  }) {
    const db = this.fastify.db;

    let newAddon = {
      id: uuidv4(),
      hotelId,
      ...addonData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!addonData.image) {
      throw new NotFoundError('Image Required')
    }
    let image = null;
    if (addonData.image.startsWith('data:image/')) {
      const buffer = Buffer.from(addonData.image.split(',')[1], 'base64');
      image = await uploadToS3(buffer, `hotel-${addonData.name}-${Date.now()}.jpg`, 'image/jpeg');
    }
    if (!image) {
      throw Error('Unable to Process Request')
    }
    newAddon = {
      ...newAddon,
      image
    }
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
    let image = null;

    if (updateData.image && updateData.image.startsWith('data:image/')) {

      const buffer = Buffer.from(updateData.image.split(',')[1], 'base64');
      image = await uploadToS3(buffer, `hotel-${addonId}-${Date.now()}.jpg`, 'image/jpeg');
    }


    if (updateData.image && !image) {
      throw Error('Unable to Process Request')
    }



    await db.update(addons)
      .set({
        ...updateData,
        image:image,
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

  // Add addons to room (append to existing)
  async addRoomAddons(hotelId: string, roomId: string, addonIds: string[]) {
    const db = this.fastify.db;

    // Verify room belongs to hotel
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room || room.hotelId !== hotelId) {
      throw new Error('Room not found or does not belong to the specified hotel');
    }

    // Verify all addons belong to the hotel and are active
    if (addonIds.length === 0) {
      throw new Error('No addon IDs provided');
    }

    const validAddons = await db.query.addons.findMany({
      where: and(
        eq(addons.hotelId, hotelId),
        eq(addons.status, 'active')
      ),
    });

    const validAddonIds = validAddons.map(a => a.id);
    const invalidAddonIds = addonIds.filter(id => !validAddonIds.includes(id));

    if (invalidAddonIds.length > 0) {
      throw new Error(`Invalid addon IDs: ${invalidAddonIds.join(', ')}. Addons must belong to the same hotel and be active.`);
    }

    // Check which addons are already mapped to avoid duplicates
    const existingMappings = await db.query.roomAddons.findMany({
      where: eq(roomAddons.roomId, roomId),
    });

    const existingAddonIds = existingMappings.map(m => m.addonId);
    const newAddonIds = addonIds.filter(id => !existingAddonIds.includes(id));

    if (newAddonIds.length === 0) {
      return {
        success: true,
        message: 'All specified addons are already mapped to this room',
        addedAddons: 0,
        skippedAddons: addonIds.length
      };
    }

    // Add new mappings
    const mappings = newAddonIds.map(addonId => ({
      id: uuidv4(),
      roomId,
      addonId,
      createdAt: new Date(),
    }));

    await db.insert(roomAddons).values(mappings);

    return {
      success: true,
      addedAddons: newAddonIds.length,
      skippedAddons: addonIds.length - newAddonIds.length,
      addedAddonIds: newAddonIds
    };
  }

  // Update room addons (replace all existing)
  async updateRoomAddons(hotelId: string, roomId: string, addonIds: string[]) {
    const db = this.fastify.db;

    // Verify room belongs to hotel
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room || room.hotelId !== hotelId) {
      throw new Error('Room not found or does not belong to the specified hotel');
    }

    // Verify all addons belong to the hotel and are active (if any provided)
    if (addonIds.length > 0) {
      const validAddons = await db.query.addons.findMany({
        where: and(
          eq(addons.hotelId, hotelId),
          eq(addons.status, 'active')
        ),
      });

      const validAddonIds = validAddons.map(a => a.id);
      const invalidAddonIds = addonIds.filter(id => !validAddonIds.includes(id));

      if (invalidAddonIds.length > 0) {
        throw new Error(`Invalid addon IDs: ${invalidAddonIds.join(', ')}. Addons must belong to the same hotel and be active.`);
      }
    }

    return await db.transaction(async (tx) => {
      // Remove existing mappings
      await tx.delete(roomAddons).where(eq(roomAddons.roomId, roomId));

      // Add new mappings if any provided
      if (addonIds.length > 0) {
        const mappings = addonIds.map(addonId => ({
          id: uuidv4(),
          roomId,
          addonId,
          createdAt: new Date(),
        }));

        await tx.insert(roomAddons).values(mappings);
      }

      return {
        success: true,
        updatedAddons: addonIds.length,
        message: `Room addons updated successfully. ${addonIds.length} addons now mapped to this room.`
      };
    });
  }

  // Remove specific addon from room
  async removeRoomAddon(hotelId: string, roomId: string, addonId: string) {
    const db = this.fastify.db;

    // Verify room belongs to hotel
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room || room.hotelId !== hotelId) {
      throw new Error('Room not found or does not belong to the specified hotel');
    }

    // Verify addon belongs to the hotel
    const addon = await db.query.addons.findFirst({
      where: and(
        eq(addons.id, addonId),
        eq(addons.hotelId, hotelId)
      ),
    });

    if (!addon) {
      throw new Error('Addon not found or does not belong to the specified hotel');
    }

    // Check if mapping exists
    const existingMapping = await db.query.roomAddons.findFirst({
      where: and(
        eq(roomAddons.roomId, roomId),
        eq(roomAddons.addonId, addonId)
      ),
    });

    if (!existingMapping) {
      throw new Error('Addon is not mapped to this room');
    }

    // Remove the mapping
    await db.delete(roomAddons).where(
      and(
        eq(roomAddons.roomId, roomId),
        eq(roomAddons.addonId, addonId)
      )
    );

    return {
      success: true,
      message: 'Addon removed from room successfully',
      removedAddonId: addonId
    };
  }

  // Get available addons for room (hotel addons not yet mapped to this room)
  async getAvailableRoomAddons(hotelId: string, roomId: string) {
    const db = this.fastify.db;

    // Verify room belongs to hotel
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    console.log('room ', room)

    if (!room || room.hotelId !== hotelId) {
      throw new Error('Room not found or does not belong to the specified hotel');
    }

    // Get all active hotel addons
    const hotelAddons = await db.query.addons.findMany({
      where: and(
        eq(addons.hotelId, hotelId),
        eq(addons.status, 'active')
      ),
      orderBy: (addons, { asc }) => [asc(addons.name)],
    });

    console.log(' hotelAddons ', hotelAddons)

    // Get already mapped addons for this room
    const mappedAddons = await db.query.roomAddons.findMany({
      where: eq(roomAddons.roomId, roomId),
    });

    const mappedAddonIds = mappedAddons.map(m => m.addonId);

    // Filter out already mapped addons
    const availableAddons = hotelAddons.filter(addon => !mappedAddonIds.includes(addon.id));

    return availableAddons;
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

    console.log('addons here ')
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

    console.log('bookingaddondata ',bookingAddonData)
    await db.insert(bookingAddons).values(bookingAddonData);
    console.log('done addons adding')
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
