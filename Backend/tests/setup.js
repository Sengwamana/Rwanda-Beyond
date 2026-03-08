/**
 * Jest Test Setup
 * 
 * Global configuration for test environment.
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console.log during tests (keep errors/warns)
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};
