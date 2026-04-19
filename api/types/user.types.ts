export interface UserName {
  firstname: string;
  lastname: string;
}

export interface UserAddress {
  city: string;
  street: string;
  number: number;
  zipcode: string;
  geolocation?: { lat: string; long: string };
}

export interface User {
  id: number;
  email: string;
  username: string;
  password: string;
  name: UserName;
  address: UserAddress;
  phone: string;
}

export type CreateUserPayload = Omit<User, 'id'>;
export type UpdateUserPayload = Partial<CreateUserPayload>;
