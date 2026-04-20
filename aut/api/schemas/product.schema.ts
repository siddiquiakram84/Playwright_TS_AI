import { Schema } from 'ajv';

export const productSchema: Schema = {
  type: 'object',
  required: ['id', 'title', 'price', 'description', 'category', 'image', 'rating'],
  properties: {
    id: { type: 'number' },
    title: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0 },
    description: { type: 'string' },
    category: { type: 'string', minLength: 1 },
    image: { type: 'string', format: 'uri' },
    rating: {
      type: 'object',
      required: ['rate', 'count'],
      properties: {
        rate: { type: 'number', minimum: 0, maximum: 5 },
        count: { type: 'number', minimum: 0 },
      },
    },
  },
};

export const productsArraySchema: Schema = {
  type: 'array',
  items: productSchema,
  minItems: 1,
};
