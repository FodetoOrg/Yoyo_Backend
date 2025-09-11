// @ts-nocheck
import { FastifyInstance } from "fastify";
import { configurations } from "../models/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

export class ConfigurationService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get all configurations
  async getAllConfigurations(category?: string) {
    const db = this.fastify.db;

    let whereConditions = [eq(configurations.isActive, true)];
    if (category) {
      whereConditions.push(eq(configurations.category, category));
    }

    const configs = await db.select()
      .from(configurations)
      .where(and(...whereConditions));

    return configs.reduce((acc, config) => {
      let value = config.value;

      // Parse value based on type
      switch (config.type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'json':
        case 'array':
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = config.value;
          }
          break;
      }

      acc[config.key] = value;
      return acc;
    }, {});
  }

  // Get specific configuration
  async getConfiguration(key: string) {
    const db = this.fastify.db;

    const config = await db.select()
      .from(configurations)
      .where(and(eq(configurations.key, key), eq(configurations.isActive, true)))
      .limit(1);

    if (config.length === 0) {
      throw new NotFoundError('Configuration not found');
    }

    const configData = config[0];
    let value = configData.value;

    // Parse value based on type
    switch (configData.type) {
      case 'boolean':
        value = value === 'true';
        break;
      case 'number':
        value = parseFloat(value);
        break;
      case 'json':
      case 'array':
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = configData.value;
        }
        break;
    }

    return { ...configData, value };
  }

  // Update or create configuration
  async setConfiguration(key: string, value: any, type: string, description?: string, category: string = 'app') {
    const db = this.fastify.db;

    let stringValue = value;
    if (type === 'json' || type === 'array') {
      stringValue = JSON.stringify(value);
    } else if (type === 'boolean') {
      stringValue = value.toString();
    } else if (type === 'number') {
      stringValue = value.toString();
    }

    const existing = await db.select()
      .from(configurations)
      .where(eq(configurations.key, key))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const updated = await db.update(configurations)
        .set({
          value: stringValue,
          type,
          description,
          category,
          updatedAt: new Date(),
        })
        .where(eq(configurations.key, key))
        .returning();

      return updated[0];
    } else {
      // Create new
      const created = await db.insert(configurations)
        .values({
          id: uuidv4(),
          key,
          value: stringValue,
          type,
          description,
          category,
        })
        .returning();

      return created[0];
    }
  }

  // Initialize default configurations
  async initializeDefaultConfigurations() {
    const defaultConfigs = [
      {
        key: 'app_maintenance_mode',
        value: 'false',
        type: 'boolean',
        description: 'Enable/disable app maintenance mode',
        category: 'app'
      },
      {
        key: 'panel_maintenance_mode',
        value: 'false',
        type: 'boolean',
        description: 'Enable/disable admin panel maintenance mode',
        category: 'app'
      },
      {
        key: 'online_payment_global_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Global online payment enable/disable',
        category: 'payment'
      },
      {
        key: 'app_banner_image',
        value: '',
        type: 'string',
        description: 'Banner image URL for app',
        category: 'ui'
      },
      {
        key: 'app_banner_coupon_code',
        value: '',
        type: 'string',
        description: 'Coupon code associated with banner',
        category: 'ui'
      },
      {
        key: 'featured_hotels',
        value: '[]',
        type: 'array',
        description: 'Array of featured hotel IDs',
        category: 'app'
      },
      {
        key: 'default_cancellation_hours',
        value: '24',
        type: 'number',
        description: 'Default cancellation period in hours',
        category: 'booking'
      },
      {
        key: 'auto_cancellation_hours',
        value: '1',
        type: 'number',
        description: 'Default cancellation period in hours if user donesnt show up',
        category: 'booking'
      },
      {
        key: 'platform_fee',
        value: '5',
        type: 'number',
        description: 'Default platform fee',
        category: 'app'
      },
      {
        key: 'general_inquiries_phone',
        value: '',
        type: 'string',
        description: 'Phone number for general inquiries',
        category: 'contact'
      },
      {
        key: 'general_inquiries_email',
        value: '',
        type: 'string',
        description: 'Email address for general inquiries',
        category: 'contact'
      },
      {
        key: 'support_phone',
        value: '',
        type: 'string',
        description: 'Phone number for customer support',
        category: 'contact'
      },
      {
        key: 'support_email',
        value: '',
        type: 'string',
        description: 'Email address for customer support',
        category: 'contact'
      }
    ];

    for (const config of defaultConfigs) {
      const existing = await this.fastify.db.select()
        .from(configurations)
        .where(eq(configurations.key, config.key))
        .limit(1);

      if (existing.length === 0) {
        await this.setConfiguration(
          config.key,
          config.value,
          config.type,
          config.description,
          config.category
        );
      }
    }
  }

  // Add method to get configuration by key
  async getConfiguration(key: string) {
    const db = this.fastify.db;

    return await db.query.configurations.findFirst({
      where: eq(configurations.key, key)
    });
  }

  async getPlatformFeePercentage(): Promise<number> {
    const config = await this.getConfiguration('platform_fee');
    return config ? parseFloat(config.value) : 5;
  }

  // Get all contact information
  async getContactInfo() {
    const db = this.fastify.db;

    const contactConfigs = await db.select()
      .from(configurations)
      .where(and(eq(configurations.category, 'contact'), eq(configurations.isActive, true)));

    const contactInfo = {
      general_inquiries: {
        phone: '',
        email: ''
      },
      support: {
        phone: '',
        email: ''
      }
    };

    contactConfigs.forEach(config => {
      switch (config.key) {
        case 'general_inquiries_phone':
          contactInfo.general_inquiries.phone = config.value;
          break;
        case 'general_inquiries_email':
          contactInfo.general_inquiries.email = config.value;
          break;
        case 'support_phone':
          contactInfo.support.phone = config.value;
          break;
        case 'support_email':
          contactInfo.support.email = config.value;
          break;
      }
    });

    return contactInfo;
  }

  // Update contact information
  async updateContactInfo(contactData: {
    general_inquiries?: { phone?: string; email?: string };
    support?: { phone?: string; email?: string };
  }) {
    const updates = [];

    if (contactData.general_inquiries?.phone !== undefined) {
      updates.push(this.setConfiguration(
        'general_inquiries_phone',
        contactData.general_inquiries.phone,
        'string',
        'Phone number for general inquiries',
        'contact'
      ));
    }

    if (contactData.general_inquiries?.email !== undefined) {
      updates.push(this.setConfiguration(
        'general_inquiries_email',
        contactData.general_inquiries.email,
        'string',
        'Email address for general inquiries',
        'contact'
      ));
    }

    if (contactData.support?.phone !== undefined) {
      updates.push(this.setConfiguration(
        'support_phone',
        contactData.support.phone,
        'string',
        'Phone number for customer support',
        'contact'
      ));
    }

    if (contactData.support?.email !== undefined) {
      updates.push(this.setConfiguration(
        'support_email',
        contactData.support.email,
        'string',
        'Email address for customer support',
        'contact'
      ));
    }

    await Promise.all(updates);
    
    // Return the updated contact information
    return await this.getContactInfo();
  }
}