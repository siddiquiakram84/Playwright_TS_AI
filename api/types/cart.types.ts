export interface CartProduct {
  productId: number;
  quantity: number;
}

export interface Cart {
  id: number;
  userId: number;
  date: string;
  products: CartProduct[];
}

export type CreateCartPayload = Omit<Cart, 'id'>;
export type UpdateCartPayload = Partial<CreateCartPayload>;
