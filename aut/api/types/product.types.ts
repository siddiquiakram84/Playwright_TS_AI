export interface ProductRating {
  rate: number;
  count: number;
}

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: ProductRating;
}

export type CreateProductPayload = Omit<Product, 'id' | 'rating'> & {
  rating?: ProductRating;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;
