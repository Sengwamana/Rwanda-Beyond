/**
 * Response Transformation Middleware
 * 
 * Converts snake_case field names from Convex to camelCase for the frontend,
 * and maps Convex's `_id` to `id` for all entities.
 * 
 * @module middleware/transformResponse
 */

/**
 * Convert a snake_case string to camelCase
 * @param {string} str
 * @returns {string}
 */
function snakeToCamel(str) {
  if (str.startsWith('_') && str !== '_id') {
    // Preserve internal Convex fields like _creationTime
    return str;
  }
  return str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Recursively transform all keys in an object/array from snake_case to camelCase.
 * Also maps `_id` → `id` and removes `_creationTime`.
 * 
 * @param {*} data - The data to transform
 * @returns {*} Transformed data
 */
export function transformKeys(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(transformKeys);
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      // Map _id → id
      if (key === '_id') {
        transformed.id = value;
        continue;
      }
      // Skip Convex internal fields
      if (key === '_creationTime') {
        continue;
      }
      const camelKey = snakeToCamel(key);
      transformed[camelKey] = transformKeys(value);
    }
    return transformed;
  }

  return data;
}

/**
 * Express middleware that intercepts JSON responses and transforms
 * snake_case keys to camelCase before sending to the client.
 */
export function transformResponseMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (body && typeof body === 'object') {
      // Only transform the `data` field inside our standard response envelope
      // to avoid breaking `success`, `message`, `pagination`, `timestamp` etc.
      if ('data' in body) {
        body.data = transformKeys(body.data);
      }
      // Also transform `pagination` keys if present (already camelCase but safe)
    }
    return originalJson(body);
  };

  next();
}

export default transformResponseMiddleware;
