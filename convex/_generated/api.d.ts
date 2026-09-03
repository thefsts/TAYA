/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessControl from "../accessControl.js";
import type * as activityLog from "../activityLog.js";
import type * as addons from "../addons.js";
import type * as adminConfig from "../adminConfig.js";
import type * as agencies from "../agencies.js";
import type * as ai from "../ai.js";
import type * as announcement from "../announcement.js";
import type * as articles from "../articles.js";
import type * as automation from "../automation.js";
import type * as backups from "../backups.js";
import type * as careers from "../careers.js";
import type * as clerkInvitations from "../clerkInvitations.js";
import type * as contact from "../contact.js";
import type * as contentModules from "../contentModules.js";
import type * as courses from "../courses.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as cta from "../cta.js";
import type * as downloads from "../downloads.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as faq from "../faq.js";
import type * as flyers from "../flyers.js";
import type * as footer from "../footer.js";
import type * as formSubmissions from "../formSubmissions.js";
import type * as forms from "../forms.js";
import type * as health from "../health.js";
import type * as healthScans from "../healthScans.js";
import type * as homepage from "../homepage.js";
import type * as http from "../http.js";
import type * as invitationState from "../invitationState.js";
import type * as lib_capabilities from "../lib/capabilities.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_crmProviders from "../lib/crmProviders.js";
import type * as lib_encrypt from "../lib/encrypt.js";
import type * as lib_formatPrice from "../lib/formatPrice.js";
import type * as lib_getCurrentUser from "../lib/getCurrentUser.js";
import type * as lib_lifecycleStatus from "../lib/lifecycleStatus.js";
import type * as lib_logActivity from "../lib/logActivity.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_recordVersion from "../lib/recordVersion.js";
import type * as lib_requirePermission from "../lib/requirePermission.js";
import type * as lib_requireSiteAccess from "../lib/requireSiteAccess.js";
import type * as lib_roleCapabilities from "../lib/roleCapabilities.js";
import type * as lib_rolePermissions from "../lib/rolePermissions.js";
import type * as lib_siteAccessInternal from "../lib/siteAccessInternal.js";
import type * as lib_siteFromSlug from "../lib/siteFromSlug.js";
import type * as lib_testMode from "../lib/testMode.js";
import type * as lib_timezoneUtils from "../lib/timezoneUtils.js";
import type * as lifecycle from "../lifecycle.js";
import type * as media from "../media.js";
import type * as mediaDerivatives from "../mediaDerivatives.js";
import type * as navigation from "../navigation.js";
import type * as onboarding from "../onboarding.js";
import type * as paymentConnectors from "../paymentConnectors.js";
import type * as policies from "../policies.js";
import type * as popup from "../popup.js";
import type * as portal from "../portal.js";
import type * as products from "../products.js";
import type * as provision from "../provision.js";
import type * as public_ from "../public.js";
import type * as publicBooking from "../publicBooking.js";
import type * as registrations from "../registrations.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as seedClient from "../seedClient.js";
import type * as seedCorsair from "../seedCorsair.js";
import type * as seo from "../seo.js";
import type * as services from "../services.js";
import type * as siteSettings from "../siteSettings.js";
import type * as sites from "../sites.js";
import type * as square from "../square.js";
import type * as squareOrders from "../squareOrders.js";
import type * as team from "../team.js";
import type * as testimonials from "../testimonials.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessControl: typeof accessControl;
  activityLog: typeof activityLog;
  addons: typeof addons;
  adminConfig: typeof adminConfig;
  agencies: typeof agencies;
  ai: typeof ai;
  announcement: typeof announcement;
  articles: typeof articles;
  automation: typeof automation;
  backups: typeof backups;
  careers: typeof careers;
  clerkInvitations: typeof clerkInvitations;
  contact: typeof contact;
  contentModules: typeof contentModules;
  courses: typeof courses;
  crm: typeof crm;
  crons: typeof crons;
  cta: typeof cta;
  downloads: typeof downloads;
  email: typeof email;
  events: typeof events;
  faq: typeof faq;
  flyers: typeof flyers;
  footer: typeof footer;
  formSubmissions: typeof formSubmissions;
  forms: typeof forms;
  health: typeof health;
  healthScans: typeof healthScans;
  homepage: typeof homepage;
  http: typeof http;
  invitationState: typeof invitationState;
  "lib/capabilities": typeof lib_capabilities;
  "lib/constants": typeof lib_constants;
  "lib/crmProviders": typeof lib_crmProviders;
  "lib/encrypt": typeof lib_encrypt;
  "lib/formatPrice": typeof lib_formatPrice;
  "lib/getCurrentUser": typeof lib_getCurrentUser;
  "lib/lifecycleStatus": typeof lib_lifecycleStatus;
  "lib/logActivity": typeof lib_logActivity;
  "lib/permissions": typeof lib_permissions;
  "lib/recordVersion": typeof lib_recordVersion;
  "lib/requirePermission": typeof lib_requirePermission;
  "lib/requireSiteAccess": typeof lib_requireSiteAccess;
  "lib/roleCapabilities": typeof lib_roleCapabilities;
  "lib/rolePermissions": typeof lib_rolePermissions;
  "lib/siteAccessInternal": typeof lib_siteAccessInternal;
  "lib/siteFromSlug": typeof lib_siteFromSlug;
  "lib/testMode": typeof lib_testMode;
  "lib/timezoneUtils": typeof lib_timezoneUtils;
  lifecycle: typeof lifecycle;
  media: typeof media;
  mediaDerivatives: typeof mediaDerivatives;
  navigation: typeof navigation;
  onboarding: typeof onboarding;
  paymentConnectors: typeof paymentConnectors;
  policies: typeof policies;
  popup: typeof popup;
  portal: typeof portal;
  portalAdmin: typeof portalAdmin;
  products: typeof products;
  provision: typeof provision;
  public: typeof public_;
  publicBooking: typeof publicBooking;
  registrations: typeof registrations;
  reviews: typeof reviews;
  seed: typeof seed;
  seedClient: typeof seedClient;
  seedCorsair: typeof seedCorsair;
  seo: typeof seo;
  services: typeof services;
  siteSettings: typeof siteSettings;
  sites: typeof sites;
  square: typeof square;
  squareOrders: typeof squareOrders;
  team: typeof team;
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
