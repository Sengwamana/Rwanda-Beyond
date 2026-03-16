/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLogs from "../auditLogs.js";
import type * as districts from "../districts.js";
import type * as farmIssues from "../farmIssues.js";
import type * as farms from "../farms.js";
import type * as fertilizationSchedules from "../fertilizationSchedules.js";
import type * as iotDeviceTokens from "../iotDeviceTokens.js";
import type * as irrigationSchedules from "../irrigationSchedules.js";
import type * as messages from "../messages.js";
import type * as pestControlSchedules from "../pestControlSchedules.js";
import type * as pestDetections from "../pestDetections.js";
import type * as recommendations from "../recommendations.js";
import type * as sensorData from "../sensorData.js";
import type * as sensors from "../sensors.js";
import type * as systemConfig from "../systemConfig.js";
import type * as users from "../users.js";
import type * as weatherData from "../weatherData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLogs: typeof auditLogs;
  districts: typeof districts;
  farmIssues: typeof farmIssues;
  farms: typeof farms;
  fertilizationSchedules: typeof fertilizationSchedules;
  iotDeviceTokens: typeof iotDeviceTokens;
  irrigationSchedules: typeof irrigationSchedules;
  messages: typeof messages;
  pestControlSchedules: typeof pestControlSchedules;
  pestDetections: typeof pestDetections;
  recommendations: typeof recommendations;
  sensorData: typeof sensorData;
  sensors: typeof sensors;
  systemConfig: typeof systemConfig;
  users: typeof users;
  weatherData: typeof weatherData;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
