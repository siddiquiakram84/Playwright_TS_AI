/**
 * Expected values for API responses — use enums/const objects in assertions
 * instead of inline strings so a single change updates all referencing tests.
 */

// ── Product domain ────────────────────────────────────────────────────────────

export enum ProductCategory {
  ELECTRONICS     = 'electronics',
  JEWELERY        = 'jewelery',
  MENS_CLOTHING   = "men's clothing",
  WOMENS_CLOTHING = "women's clothing",
}

export const PRODUCT_CATEGORY_COUNT = 4 as const;

export const VALID_PRODUCT_ID_RANGE = { min: 1, max: 20 } as const;

export enum ProductConstraints {
  TITLE_MIN_LENGTH = 1,
  PRICE_MIN        = 0,
  RATING_MIN       = 0,
  RATING_MAX       = 5,
  COUNT_MIN        = 0,
}

// ── Cart domain ───────────────────────────────────────────────────────────────

export enum CartConstraints {
  MIN_QUANTITY        = 1,
  MIN_PRODUCT_COUNT   = 1,
  VALID_USER_ID_MIN   = 1,
}

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

// ── User domain ───────────────────────────────────────────────────────────────

export enum UserConstraints {
  MIN_ID             = 1,
  EMAIL_REGEX_STRING = '.+@.+\\..+',
  USERNAME_MIN       = 1,
  PHONE_MIN          = 5,
}

// ── Auth domain ───────────────────────────────────────────────────────────────

export enum AuthMessages {
  // FakeStoreAPI returns this exact string for invalid credentials
  INVALID_CREDENTIALS = 'username or password is incorrect',
}

export enum TokenConstraints {
  MIN_LENGTH = 10,
}
