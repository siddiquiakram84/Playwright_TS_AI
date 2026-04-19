import { Schema } from 'ajv';

export const cartSchema: Schema = {
  type: 'object',
  required: ['id', 'userId', 'date', 'products'],
  properties: {
    id: { type: 'number' },
    userId: { type: 'number' },
    date: { type: 'string' },
    products: {
      type: 'array',
      items: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'number' },
          quantity: { type: 'number', minimum: 1 },
        },
      },
    },
  },
};
