/** HTTP status codes as a typed enum — use in every assertion instead of magic numbers. */
export enum HttpStatus {
  OK                    = 200,
  CREATED               = 201,
  NO_CONTENT            = 204,
  BAD_REQUEST           = 400,
  UNAUTHORIZED          = 401,
  FORBIDDEN             = 403,
  NOT_FOUND             = 404,
  METHOD_NOT_ALLOWED    = 405,
  CONFLICT              = 409,
  UNPROCESSABLE_ENTITY  = 422,
  TOO_MANY_REQUESTS     = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE   = 503,
}

/** Maximum acceptable response times per tier (milliseconds). */
export enum ResponseTimeLimit {
  FAST     = 500,   // reads, lightweight operations
  NORMAL   = 1500,  // writes, simple queries
  SLOW     = 3000,  // heavy aggregations, auth with hashing
}
