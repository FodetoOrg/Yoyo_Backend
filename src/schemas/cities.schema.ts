import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
});

export const getAllCitiesSchema = {
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.array(
          citySchema.extend({
            numberOfHotels: z.number(),
          })
        ),
      })
    ),
  },
};

export const getCityByIdSchema = {
  params: zodToJsonSchema(
    z.object({
      id: z.string().uuid(),
    })
  ),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: citySchema,
      })
    ),
  },
};

export const createCitySchema = {
  body: zodToJsonSchema(
    z.object({
      name: z.string(),
      state: z.string(),
    })
  ),
  response: {
    201: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: citySchema,
      })
    ),
  },
};

export const updateCitySchema = {
  params: zodToJsonSchema(
    z.object({
      id: z.string().uuid(),
    })
  ),
  body: zodToJsonSchema(citySchema),
};
