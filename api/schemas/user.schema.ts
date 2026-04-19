import { Schema } from 'ajv';

export const userSchema: Schema = {
  type: 'object',
  required: ['id', 'email', 'username', 'password', 'name', 'address', 'phone'],
  properties: {
    id: { type: 'number' },
    email: { type: 'string', format: 'email' },
    username: { type: 'string', minLength: 1 },
    password: { type: 'string' },
    name: {
      type: 'object',
      required: ['firstname', 'lastname'],
      properties: {
        firstname: { type: 'string' },
        lastname: { type: 'string' },
      },
    },
    address: {
      type: 'object',
      required: ['city', 'street', 'number', 'zipcode'],
      properties: {
        city: { type: 'string' },
        street: { type: 'string' },
        number: { type: 'number' },
        zipcode: { type: 'string' },
      },
    },
    phone: { type: 'string' },
  },
};
