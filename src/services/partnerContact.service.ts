//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { partnerContacts } from '../models/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface CreatePartnerContactData {
  hotelName: string;
  numberOfRooms: number;
  hotelDescription?: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
  city: string;
}

interface UpdatePartnerContactData {
  status?: string;
  notes?: string;
  contactedAt?: Date;
}

export class PartnerContactService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async createPartnerContact(data: CreatePartnerContactData) {
    const db = this.fastify.db;
    const contactId = uuidv4();

    await db.insert(partnerContacts).values({
      id: contactId,
      ...data,
    });

    return {
      id: contactId,
      message: 'Partner contact request submitted successfully'
    };
  }

  async getPartnerContacts(page: number = 1, limit: number = 10, status?: string) {
    const db = this.fastify.db;

    const whereCondition = status ? eq(partnerContacts.status, status) : undefined;

    const contacts = await db.query.partnerContacts.findMany({
      where: whereCondition,
      orderBy: [desc(partnerContacts.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    const total = await db.query.partnerContacts.findMany({
      where: whereCondition,
    });

    return {
      contacts,
      total: total.length,
      page,
      limit,
      totalPages: Math.ceil(total.length / limit),
    };
  }

  async updatePartnerContact(id: string, data: UpdatePartnerContactData) {
    const db = this.fastify.db;

    await db.update(partnerContacts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(partnerContacts.id, id));

    return { success: true, message: 'Partner contact updated successfully' };
  }

  async getPartnerContactById(id: string) {
    const db = this.fastify.db;

    const contact = await db.query.partnerContacts.findFirst({
      where: eq(partnerContacts.id, id),
    });

    if (!contact) {
      throw new Error('Partner contact not found');
    }

    return contact;
  }
}
