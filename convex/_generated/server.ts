/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  type GenericActionCtx,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type GenericDatabaseReader,
  type GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Define a query in this Convex app's public API.
 */
export const query = queryGeneric as unknown as import("convex/server").QueryBuilder<DataModel, "public">;

/**
 * Define a mutation in this Convex app's public API.
 */
export const mutation = mutationGeneric as unknown as import("convex/server").MutationBuilder<DataModel, "public">;

/**
 * Define an action in this Convex app's public API.
 */
export const action = actionGeneric;

/**
 * Define a Convex HTTP action.
 */
export const httpAction = httpActionGeneric;

/**
 * Define a query that is only accessible from other Convex functions (not the client).
 */
export const internalQuery = internalQueryGeneric as unknown as import("convex/server").QueryBuilder<DataModel, "internal">;

/**
 * Define a mutation that is only accessible from other Convex functions (not the client).
 */
export const internalMutation = internalMutationGeneric as unknown as import("convex/server").MutationBuilder<DataModel, "internal">;

/**
 * Define an action that is only accessible from other Convex functions (not the client).
 */
export const internalAction = internalActionGeneric;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
