import Ajv, { Schema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const cache = new Map<Schema, ValidateFunction>();

export function validateSchema<T>(data: unknown, schema: Schema): asserts data is T {
  let validate = cache.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    cache.set(schema, validate);
  }

  const valid = validate(data);
  if (!valid) {
    const errors = ajv.errorsText(validate.errors, { separator: '\n  - ' });
    throw new Error(`Schema validation failed:\n  - ${errors}`);
  }
}

export function isValidSchema<T>(data: unknown, schema: Schema): data is T {
  try {
    validateSchema<T>(data, schema);
    return true;
  } catch {
    return false;
  }
}
