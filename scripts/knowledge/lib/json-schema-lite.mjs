function typeOf(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function addError(errors, at, message) {
  errors.push(`${at}: ${message}`);
}

export function validateJsonSchemaValue(value, schema, at = "$", errors = []) {
  if (!schema || typeof schema !== "object") {
    addError(errors, at, "invalid schema object");
    return errors;
  }

  if (schema.type) {
    const actualType = typeOf(value);
    if (schema.type === "integer") {
      if (!Number.isInteger(value)) {
        addError(errors, at, `expected integer, got ${actualType}`);
        return errors;
      }
    } else if (schema.type === "object") {
      if (actualType !== "object") {
        addError(errors, at, `expected object, got ${actualType}`);
        return errors;
      }
    } else if (schema.type !== actualType) {
      addError(errors, at, `expected ${schema.type}, got ${actualType}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    addError(errors, at, `must be one of: ${schema.enum.join(", ")}`);
  }

  if (schema.type === "string") {
    if (schema.minLength && value.length < schema.minLength) {
      addError(errors, at, `must be at least ${schema.minLength} chars`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      addError(errors, at, `must match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      addError(errors, at, "must be a valid date-time");
    }
  }

  if (schema.type === "integer" && typeof schema.minimum === "number" && value < schema.minimum) {
    addError(errors, at, `must be >= ${schema.minimum}`);
  }

  if (schema.type === "array") {
    if (schema.minItems && value.length < schema.minItems) {
      addError(errors, at, `must contain at least ${schema.minItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateJsonSchemaValue(item, schema.items, `${at}[${index}]`, errors));
    }
  }

  if (schema.type === "object") {
    const keys = new Set(Object.keys(value));
    for (const requiredKey of schema.required ?? []) {
      if (!keys.has(requiredKey)) {
        addError(errors, at, `missing required key "${requiredKey}"`);
      }
    }

    const definedProperties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of keys) {
        if (!(key in definedProperties)) {
          addError(errors, `${at}.${key}`, "unexpected property");
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(definedProperties)) {
      if (key in value) {
        validateJsonSchemaValue(value[key], propertySchema, `${at}.${key}`, errors);
      }
    }
  }

  return errors;
}
