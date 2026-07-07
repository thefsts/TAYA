/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

import type * as activityLog from "../activityLog.js";
import type * as articles from "../articles.js";
import type * as backups from "../backups.js";
import type * as contact from "../contact.js";
import type * as courses from "../courses.js";
import type * as crm from "../crm.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as footer from "../footer.js";
import type * as health from "../health.js";
import type * as homepage from "../homepage.js";
import type * as media from "../media.js";
import type * as seo from "../seo.js";
import type * as sites from "../sites.js";
import type * as square from "../square.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  activityLog: typeof activityLog;
  articles: typeof articles;
  backups: typeof backups;
  contact: typeof contact;
  courses: typeof courses;
  crm: typeof crm;
  email: typeof email;
  events: typeof events;
  footer: typeof footer;
  health: typeof health;
  homepage: typeof homepage;
  media: typeof media;
  seo: typeof seo;
  sites: typeof sites;
  square: typeof square;
  users: typeof users;
  versions: typeof versions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export default api;
