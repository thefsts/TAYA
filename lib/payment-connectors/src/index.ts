/**
 * Payment Connector Framework™ — WOS Phase 1
 *
 * Defines the universal PaymentConnector interface and shared types that
 * every provider adapter must implement. Square is the first live adapter;
 * all others ship as stubs (coming soon).
 */

/* ── Provider registry ──────────────────────────────────────────────────── */

export const CRM_PAYMENT_PROVIDERS = [
  "square",
  "stripe",
  "paypal",
  "authorize_net",
  "clover",
  "manual_invoice",
  "bank_transfer",
] as const;

export type PaymentProvider = (typeof CRM_PAYMENT_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  square: "Square",
  stripe: "Stripe",
  paypal: "PayPal",
  authorize_net: "Authorize.net",
  clover: "Clover",
  manual_invoice: "Manual Invoice",
  bank_transfer: "Bank Transfer",
};

export const PROVIDER_DESCRIPTIONS: Record<PaymentProvider, string> = {
  square: "Point-of-sale, online checkout, and catalog sync via Square APIs.",
  stripe: "Flexible payment processing for one-time and recurring payments.",
  paypal: "Accept PayPal, credit, and debit payments via PayPal Checkout.",
  authorize_net: "Enterprise-grade payment gateway with advanced fraud tools.",
  clover: "POS and payment processing for brick-and-mortar businesses.",
  manual_invoice: "Generate and track manual invoices without a payment gateway.",
  bank_transfer: "Accept ACH / wire transfer payments with manual reconciliation.",
};

export const LIVE_PROVIDERS = new Set<PaymentProvider>(["square"]);

/* ── Shared result types ────────────────────────────────────────────────── */

export interface ProviderError {
  code: string;
  message: string;
  providerDetail?: string;
}

export interface OrderResult {
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  itemName?: string;
  receiptUrl?: string;
  providerOrderId: string;
  createdAt: number;
}

export interface PaymentResult {
  paymentId: string;
  orderId?: string;
  status: string;
  amountCents: number;
  currency: string;
  providerPaymentId: string;
  receiptUrl?: string;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  status: string;
  amountCents: number;
  currency: string;
  reason?: string;
}

export interface WebhookVerifyResult {
  valid: boolean;
  eventType?: string;
  eventId?: string;
  payload?: unknown;
  error?: string;
}

export interface CustomerResult {
  customerId: string;
  email: string;
  name?: string;
  phone?: string;
  providerCustomerId: string;
}

export interface ProductSyncResult {
  synced: number;
  failed: number;
  items: Array<{ id: string; name: string; priceCents?: number }>;
}

export interface EventSyncResult {
  synced: number;
  failed: number;
  events: Array<{ id: string; title: string; startAt: number }>;
}

export interface CourseSyncResult {
  synced: number;
  failed: number;
  courses: Array<{ id: string; title: string; priceCents?: number }>;
}

export interface ReceiptResult {
  receiptUrl?: string;
  receiptHtml?: string;
  orderId: string;
  paymentId?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/* ── Connector credentials (provider-agnostic) ──────────────────────────── */

export interface ConnectorCredentials {
  provider: PaymentProvider;
  environment?: "sandbox" | "production";
  [key: string]: unknown;
}

export interface SquareCredentials extends ConnectorCredentials {
  provider: "square";
  applicationId: string;
  accessToken: string;
  locationId: string;
  webhookSignatureKey?: string;
  environment: "sandbox" | "production";
}

export interface StripeCredentials extends ConnectorCredentials {
  provider: "stripe";
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  environment: "sandbox" | "production";
}

export interface PayPalCredentials extends ConnectorCredentials {
  provider: "paypal";
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  environment: "sandbox" | "production";
}

export interface AuthorizeNetCredentials extends ConnectorCredentials {
  provider: "authorize_net";
  apiLoginId: string;
  transactionKey: string;
  signatureKey?: string;
  environment: "sandbox" | "production";
}

export interface CloverCredentials extends ConnectorCredentials {
  provider: "clover";
  merchantId: string;
  apiKey: string;
  environment: "sandbox" | "production";
}

export interface ManualInvoiceCredentials extends ConnectorCredentials {
  provider: "manual_invoice";
  businessName?: string;
  paymentInstructions?: string;
}

export interface BankTransferCredentials extends ConnectorCredentials {
  provider: "bank_transfer";
  accountName?: string;
  routingNumber?: string;
  accountNumber?: string;
  instructions?: string;
}

/* ── Connector settings (non-secret) ───────────────────────────────────── */

export interface ConnectorSettings {
  checkoutEnabled?: boolean;
  autoSyncCatalog?: boolean;
  syncIntervalMinutes?: number;
  [key: string]: unknown;
}

/* ── Connector status ───────────────────────────────────────────────────── */

export type ConnectorStatus = "connected" | "disconnected" | "error" | "pending" | "coming_soon";

export interface ConnectorRecord {
  id: string;
  siteId: string;
  provider: PaymentProvider;
  isActive: boolean;
  status: ConnectorStatus;
  environment?: "sandbox" | "production";
  credentialsMeta?: Record<string, unknown>;
  hasWebhookKey: boolean;
  checkoutEnabled: boolean;
  healthStatus?: "ok" | "error" | "unchecked";
  healthMessage?: string;
  lastHealthCheckAt?: number;
  lastSyncAt?: number;
  settings?: ConnectorSettings;
  createdAt: string;
  updatedAt: string;
}

/* ── The universal interface ────────────────────────────────────────────── */

export interface PaymentConnector {
  readonly provider: PaymentProvider;

  /**
   * Create a new order in the payment system.
   */
  createOrder(params: {
    siteId: string;
    amountCents: number;
    currency?: string;
    customerId?: string;
    lineItems?: Array<{ name: string; quantity: number; priceCents: number }>;
    referenceId?: string;
  }): Promise<OrderResult>;

  /**
   * Process a payment for an existing order.
   */
  createPayment(params: {
    siteId: string;
    orderId: string;
    sourceId: string;
    amountCents: number;
    currency?: string;
    customerEmail?: string;
    customerName?: string;
  }): Promise<PaymentResult>;

  /**
   * Issue a full or partial refund on a completed payment.
   */
  refund(params: {
    siteId: string;
    paymentId: string;
    amountCents?: number;
    reason?: string;
  }): Promise<RefundResult>;

  /**
   * Verify the authenticity of an incoming webhook payload.
   */
  verifyWebhook(params: {
    rawBody: string;
    signature: string;
    webhookSecret: string;
    requestUrl?: string;
  }): Promise<WebhookVerifyResult>;

  /**
   * Create or update a customer record in the payment provider.
   */
  createCustomer(params: {
    siteId: string;
    email: string;
    name?: string;
    phone?: string;
  }): Promise<CustomerResult>;

  /**
   * Pull the provider's product/item catalog into the dashboard.
   */
  syncProducts(params: { siteId: string }): Promise<ProductSyncResult>;

  /**
   * Push dashboard events to the provider catalog.
   */
  syncEvents(params: {
    siteId: string;
    events: Array<{ id: string; title: string; priceCents?: number; startAt: number }>;
  }): Promise<EventSyncResult>;

  /**
   * Push dashboard courses to the provider catalog.
   */
  syncCourses(params: {
    siteId: string;
    courses: Array<{ id: string; title: string; priceCents?: number }>;
  }): Promise<CourseSyncResult>;

  /**
   * Retrieve a receipt for a completed payment.
   */
  getReceipt(params: {
    siteId: string;
    paymentId: string;
    orderId?: string;
  }): Promise<ReceiptResult>;

  /**
   * Verify the provider API is reachable and credentials are valid.
   */
  healthCheck(params: { siteId: string }): Promise<HealthCheckResult>;
}

/* ── Stub adapter for coming-soon providers ─────────────────────────────── */

export class StubConnector implements PaymentConnector {
  readonly provider: PaymentProvider;

  constructor(provider: PaymentProvider) {
    this.provider = provider;
  }

  private notReady(): never {
    throw new Error(`${PROVIDER_LABELS[this.provider]} integration is coming soon.`);
  }

  createOrder(_p: Parameters<PaymentConnector["createOrder"]>[0]): Promise<OrderResult> { this.notReady(); }
  createPayment(_p: Parameters<PaymentConnector["createPayment"]>[0]): Promise<PaymentResult> { this.notReady(); }
  refund(_p: Parameters<PaymentConnector["refund"]>[0]): Promise<RefundResult> { this.notReady(); }
  verifyWebhook(_p: Parameters<PaymentConnector["verifyWebhook"]>[0]): Promise<WebhookVerifyResult> { this.notReady(); }
  createCustomer(_p: Parameters<PaymentConnector["createCustomer"]>[0]): Promise<CustomerResult> { this.notReady(); }
  syncProducts(_p: Parameters<PaymentConnector["syncProducts"]>[0]): Promise<ProductSyncResult> { this.notReady(); }
  syncEvents(_p: Parameters<PaymentConnector["syncEvents"]>[0]): Promise<EventSyncResult> { this.notReady(); }
  syncCourses(_p: Parameters<PaymentConnector["syncCourses"]>[0]): Promise<CourseSyncResult> { this.notReady(); }
  getReceipt(_p: Parameters<PaymentConnector["getReceipt"]>[0]): Promise<ReceiptResult> { this.notReady(); }
  healthCheck(_p: Parameters<PaymentConnector["healthCheck"]>[0]): Promise<HealthCheckResult> { this.notReady(); }
}

/* ── Factory ────────────────────────────────────────────────────────────── */

export function getConnectorStub(provider: PaymentProvider): PaymentConnector {
  return new StubConnector(provider);
}

/* ── Re-export concrete adapters ───────────────────────────────────────── */

export { SquareConnector } from "./square.js";

// ── Website Reviews Module™ — Review Connector Framework™ ────────────────────

/* ── Review provider registry ──────────────────────────────────────────── */

export const REVIEW_PROVIDERS = [
  "google",
  "facebook",
  "yelp",
] as const;

export type ReviewProvider = (typeof REVIEW_PROVIDERS)[number];

export const REVIEW_PROVIDER_LABELS: Record<ReviewProvider, string> = {
  google: "Google Business Profile",
  facebook: "Facebook",
  yelp: "Yelp",
};

export const REVIEW_PROVIDER_DESCRIPTIONS: Record<ReviewProvider, string> = {
  google: "Import star ratings and review text from your Google Business Profile listing.",
  facebook: "Import recommendations from your Facebook Page.",
  yelp: "Import review excerpts from your Yelp business page (per Yelp ToS).",
};

/** Fields in the connect-dialog config that contain secrets (encrypted at rest). */
export const REVIEW_PROVIDER_SECRET_FIELDS: Record<ReviewProvider, string[]> = {
  google: ["apiKey"],
  facebook: ["accessToken"],
  yelp: ["apiKey"],
};

/* ── Shared result types ────────────────────────────────────────────────── */

export interface ReviewItem {
  externalId: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  rating: number;
  text?: string;
  reviewDate: number;
}

export interface ReviewFetchResult {
  reviews: ReviewItem[];
  totalFetched: number;
  provider: ReviewProvider;
}

/* ── The universal connector interface ──────────────────────────────────── */

export interface ReviewConnector {
  readonly provider: ReviewProvider;

  /**
   * Fetch recent reviews from the provider.
   * @param config   Non-secret provider config (e.g. placeId, pageId, businessId).
   * @param credentials  Decrypted secret values (e.g. apiKey, accessToken).
   * @param maxResults   Maximum number of reviews to return.
   */
  fetchReviews(params: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    maxResults?: number;
  }): Promise<ReviewFetchResult>;

  /**
   * Verify the provider API is reachable and credentials are valid.
   */
  healthCheck(params: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
  }): Promise<HealthCheckResult>;
}

/* ── Stub adapters (coming-soon — real calls wired in future task) ────── */

class StubReviewConnector implements ReviewConnector {
  readonly provider: ReviewProvider;

  constructor(provider: ReviewProvider) {
    this.provider = provider;
  }

  private notReady(): never {
    throw new Error(
      `Live ${REVIEW_PROVIDER_LABELS[this.provider]} connector is not yet implemented. ` +
      "Reviews will be importable once the adapter is wired."
    );
  }

  fetchReviews(_p: Parameters<ReviewConnector["fetchReviews"]>[0]): Promise<ReviewFetchResult> {
    this.notReady();
  }

  healthCheck(_p: Parameters<ReviewConnector["healthCheck"]>[0]): Promise<HealthCheckResult> {
    this.notReady();
  }
}

export class GoogleReviewsConnector extends StubReviewConnector {
  constructor() { super("google"); }
}

export class FacebookReviewsConnector extends StubReviewConnector {
  constructor() { super("facebook"); }
}

export class YelpReviewsConnector extends StubReviewConnector {
  constructor() { super("yelp"); }
}

/* ── Factory ────────────────────────────────────────────────────────────── */

export function getReviewConnectorStub(provider: ReviewProvider): ReviewConnector {
  switch (provider) {
    case "google": return new GoogleReviewsConnector();
    case "facebook": return new FacebookReviewsConnector();
    case "yelp": return new YelpReviewsConnector();
    default: return new StubReviewConnector(provider as ReviewProvider);
  }
}
