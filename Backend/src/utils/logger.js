/**
 * Winston Logger Configuration
 * 
 * Provides structured logging with multiple transports for
 * development and production environments.
 * 
 * @module utils/logger
 */

import winston from 'winston';
import config from '../config/index.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Custom log format for development
 */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) log += `\n${stack}`;
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return log;
});

/**
 * Create logger instance with appropriate configuration
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  defaultMeta: { service: 'smart-maize-backend' },
  transports: []
});

// Development: Console with colors
if (config.server.isDevelopment) {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      devFormat
    )
  }));
}

// Production: JSON format for log aggregation
if (config.server.isProduction) {
  logger.add(new winston.transports.Console({
    format: combine(json())
  }));
  
  // File transports for production
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(json()),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: combine(json()),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * Stream for Morgan HTTP logging integration
 */
logger.stream = {
  write: (message) => logger.info(message.trim())
};

/**
 * Log levels:
 * - error: Error events that require immediate attention
 * - warn: Warning conditions that may indicate problems
 * - info: Informational messages about normal operations
 * - http: HTTP request logging
 * - debug: Detailed debugging information
 */

export default logger;
