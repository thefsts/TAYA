/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLog from "../activityLog.js";
import type * as articles from "../articles.js";
import type * as backups from "../backups.js";
import type * as contact from "../contact.js";
import type * as contentModules from "../contentModules.js";
import type * as courses from "../courses.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as faq from "../faq.js";
import type * as footer from "../footer.js";
import type * as formSubmissions from "../formSubmissions.js";
import type * as health from "../health.js";
import type * as homepage from "../homepage.js";
import type * as http from "../http.js";
import type * as lib_encrypt from "../lib/encrypt.js";
import type * as lib_getCurrentUser from "../lib/getCurrentUser.js";
import type * as lib_logActivity from "../lib/logActivity.js";
import type * as lib_recordVersion from "../lib/recordVersion.js";
import type * as lib_requireSiteAccess from "../lib/requireSiteAccess.js";
import type * as media from "../media.js";
import type * as public_ from "../public.js";
import type * as seo from "../seo.js";
import type * as sites from "../sites.js";
import type * as square from "../square.js";
import type * as squareOrders from "../squareOrders.js";
import type * as testimonials from "../testimonials.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLog: typeof activityLog;
  articles: typeof articles;
  backups: typeof backups;
  contact: typeof contact;
  contentModules: typeof contentModules;
  courses: typeof courses;
  crm: typeof crm;
  crons: typeof crons;
  email: typeof email;
  events: typeof events;
  faq: typeof faq;
  footer: typeof footer;
  formSubmissions: typeof formSubmissions;
  health: typeof health;
  homepage: typeof homepage;
  http: typeof http;
  "lib/encrypt": typeof lib_encrypt;
  "lib/getCurrentUser": typeof lib_getCurrentUser;
  "lib/logActivity": typeof lib_logActivity;
  "lib/recordVersion": typeof lib_recordVersion;
  "lib/requireSiteAccess": typeof lib_requireSiteAccess;
  media: typeof media;
  public: typeof public_;
  seo: typeof seo;
  sites: typeof sites;
  square: typeof square;
  squareOrders: typeof squareOrders;
  testimonials: typeof testimonials;
  users: typeof users;
  versions: typeof versions;
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
