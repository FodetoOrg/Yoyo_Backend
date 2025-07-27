
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Base schemas
export const PartnerContactResponseSchema = z.object({
  id: z.string().uuid(),
  hotelName: z.string(),
  numberOfRooms: z.number().int(),
  hotelDescription: z.string(),
  ownerName: z.string(),
  ownerEmail: z.string().email(),
  ownerPhone: z.string(),
  address: z.string(),
  city: z.string(),
  status: z.enum(['pending', 'contacted', 'rejected', 'onboarded']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Create partner contact schemas
export const CreatePartnerContactBodySchema = z.object({
  hotelName: z.string().min(1, 'Hotel name is required'),
  numberOfRooms: z.number().int().min(1, 'Number of rooms must be at least 1'),
  hotelDescription: z.string().min(10, 'Hotel description must be at least 10 characters'),
  ownerName: z.string().min(1, 'Owner name is required'),
  ownerEmail: z.string().email('Invalid email address'),
  ownerPhone: z.string().min(1, 'Owner phone is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required')
});

export const CreatePartnerContactResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    partnerContact: PartnerContactResponseSchema
  })
});

// Get partner contact schemas
export const GetPartnerContactParamsSchema = z.object({
  id: z.string().uuid()
});

export const GetPartnerContactResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    partnerContact: PartnerContactResponseSchema
  })
});

// Get all partner contacts schemas
export const GetAllPartnerContactsQuerySchema = z.object({
  status: z.enum(['pending', 'contacted', 'rejected', 'onboarded']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export const GetAllPartnerContactsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    partnerContacts: z.array(PartnerContactResponseSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int()
  })
});

// Update partner contact status schemas
export const UpdatePartnerContactStatusParamsSchema = z.object({
  id: z.string().uuid()
});

export const UpdatePartnerContactStatusBodySchema = z.object({
  status: z.enum(['pending', 'contacted', 'rejected', 'onboarded']),
  notes: z.string().optional()
});

export const UpdatePartnerContactStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    partnerContact: PartnerContactResponseSchema
  })
});

// Error schemas
export const PartnerContactErrorSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// Fastify schema objects
export const createPartnerContactSchema = {
  body: zodToJsonSchema(CreatePartnerContactBodySchema),
  response: {
    201: zodToJsonSchema(CreatePartnerContactResponseSchema),
    400: zodToJsonSchema(PartnerContactErrorSchema)
  }
};

export const getPartnerContactSchema = {
  params: zodToJsonSchema(GetPartnerContactParamsSchema),
  response: {
    200: zodToJsonSchema(GetPartnerContactResponseSchema),
    404: zodToJsonSchema(PartnerContactErrorSchema)
  }
};

export const getAllPartnerContactsSchema = {
  querystring: zodToJsonSchema(GetAllPartnerContactsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllPartnerContactsResponseSchema)
  }
};

export const updatePartnerContactStatusSchema = {
  params: zodToJsonSchema(UpdatePartnerContactStatusParamsSchema),
  body: zodToJsonSchema(UpdatePartnerContactStatusBodySchema),
  response: {
    200: zodToJsonSchema(UpdatePartnerContactStatusResponseSchema),
    404: zodToJsonSchema(PartnerContactErrorSchema)
  }
};
