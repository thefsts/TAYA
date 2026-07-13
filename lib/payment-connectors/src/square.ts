/**
 * SquareConnector — concrete implementation of PaymentConnector for Square.
 *
 * Instantiate with decrypted credentials. All network calls go through the
 * Square REST API; no Square SDK dependency is required.
 */

import type {
  PaymentConnector,
  SquareCredentials,
  OrderResult,
  PaymentResult,
  RefundResult,
  WebhookVerifyResult,
  CustomerResult,
  ProductSyncResult,
  EventSyncResult,
  CourseSyncResult,
  ReceiptResult,
  HealthCheckResult,
} from "./index.js";

const SQUARE_API_VERSION = "2024-01-17";

export class SquareConnector implements PaymentConnector {
  readonly provider = "square" as const;
  private readonly creds: SquareCredentials;
  private readonly baseUrl: string;

  constructor(creds: SquareCredentials) {
    this.creds = creds;
    this.baseUrl =
      creds.environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.creds.accessToken}`,
      "Square-Version": SQUARE_API_VERSION,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = (data as any)?.errors?.[0]?.detail ?? res.statusText;
      throw new Error(`Square API error ${res.status}: ${detail}`);
    }
    return data as T;
  }

  async healthCheck(_params: { siteId: string }): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const data: any = await this.request("GET", "/v2/locations");
      const latencyMs = Date.now() - start;
      const locationCount: number = (data.locations ?? []).length;
      return {
        ok: true,
        latencyMs,
        message: `Connected. ${locationCount} location(s) found.`,
        details: { locationCount },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async verifyWebhook(params: {
    rawBody: string;
    signature: string;
    webhookSecret: string;
    requestUrl?: string;
  }): Promise<WebhookVerifyResult> {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(params.webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sigBuffer = await crypto.subtle.sign(
        "HMAC",
        keyMaterial,
        enc.encode((params.requestUrl ?? "") + params.rawBody)
      );
      const expected = btoa(
        String.fromCharCode(...new Uint8Array(sigBuffer))
      );
      const valid = expected === params.signature;
      if (!valid) return { valid: false, error: "Signature mismatch" };
      const payload = JSON.parse(params.rawBody);
      return {
        valid: true,
        eventType: (payload as any).type,
        eventId: (payload as any).event_id,
        payload,
      };
    } catch (err: unknown) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createOrder(params: {
    siteId: string;
    amountCents: number;
    currency?: string;
    customerId?: string;
    lineItems?: Array<{ name: string; quantity: number; priceCents: number }>;
    referenceId?: string;
  }): Promise<OrderResult> {
    const lineItems = params.lineItems?.map((li) => ({
      name: li.name,
      quantity: String(li.quantity),
      base_price_money: { amount: li.priceCents, currency: params.currency ?? "USD" },
    })) ?? [
      {
        name: "Payment",
        quantity: "1",
        base_price_money: { amount: params.amountCents, currency: params.currency ?? "USD" },
      },
    ];

    const data: any = await this.request("POST", "/v2/orders", {
      order: {
        location_id: this.creds.locationId,
        reference_id: params.referenceId,
        customer_id: params.customerId,
        line_items: lineItems,
      },
      idempotency_key: crypto.randomUUID(),
    });

    const order = data.order;
    return {
      orderId: order.id,
      status: order.state,
      amountCents: order.total_money?.amount ?? params.amountCents,
      currency: order.total_money?.currency ?? "USD",
      providerOrderId: order.id,
      createdAt: new Date(order.created_at).getTime(),
    };
  }

  async createPayment(params: {
    siteId: string;
    orderId: string;
    sourceId: string;
    amountCents: number;
    currency?: string;
    customerEmail?: string;
    customerName?: string;
  }): Promise<PaymentResult> {
    const data: any = await this.request("POST", "/v2/payments", {
      source_id: params.sourceId,
      idempotency_key: crypto.randomUUID(),
      amount_money: { amount: params.amountCents, currency: params.currency ?? "USD" },
      order_id: params.orderId,
      location_id: this.creds.locationId,
      buyer_email_address: params.customerEmail,
    });

    const payment = data.payment;
    return {
      paymentId: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amountCents: payment.amount_money?.amount ?? params.amountCents,
      currency: payment.amount_money?.currency ?? "USD",
      providerPaymentId: payment.id,
      receiptUrl: payment.receipt_url,
    };
  }

  async refund(params: {
    siteId: string;
    paymentId: string;
    amountCents?: number;
    reason?: string;
  }): Promise<RefundResult> {
    const data: any = await this.request("POST", "/v2/refunds", {
      idempotency_key: crypto.randomUUID(),
      payment_id: params.paymentId,
      amount_money: params.amountCents
        ? { amount: params.amountCents, currency: "USD" }
        : undefined,
      reason: params.reason,
    });

    const refund = data.refund;
    return {
      refundId: refund.id,
      paymentId: refund.payment_id,
      status: refund.status,
      amountCents: refund.amount_money?.amount ?? 0,
      currency: refund.amount_money?.currency ?? "USD",
      reason: params.reason,
    };
  }

  async createCustomer(params: {
    siteId: string;
    email: string;
    name?: string;
    phone?: string;
  }): Promise<CustomerResult> {
    const nameParts = params.name?.split(" ") ?? [];
    const data: any = await this.request("POST", "/v2/customers", {
      idempotency_key: crypto.randomUUID(),
      email_address: params.email,
      given_name: nameParts[0],
      family_name: nameParts.slice(1).join(" ") || undefined,
      phone_number: params.phone,
    });

    const customer = data.customer;
    return {
      customerId: customer.id,
      email: customer.email_address ?? params.email,
      name: [customer.given_name, customer.family_name].filter(Boolean).join(" ") || params.name,
      phone: customer.phone_number ?? params.phone,
      providerCustomerId: customer.id,
    };
  }

  async syncProducts(_params: { siteId: string }): Promise<ProductSyncResult> {
    const data: any = await this.request("GET", "/v2/catalog/list?types=ITEM");
    const items = (data.objects ?? []).map((obj: any) => ({
      id: obj.id,
      name: obj.item_data?.name ?? obj.id,
      priceCents: obj.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount,
    }));
    return { synced: items.length, failed: 0, items };
  }

  async syncEvents(_params: {
    siteId: string;
    events: Array<{ id: string; title: string; priceCents?: number; startAt: number }>;
  }): Promise<EventSyncResult> {
    return { synced: 0, failed: 0, events: [] };
  }

  async syncCourses(_params: {
    siteId: string;
    courses: Array<{ id: string; title: string; priceCents?: number }>;
  }): Promise<CourseSyncResult> {
    return { synced: 0, failed: 0, courses: [] };
  }

  async getReceipt(params: {
    siteId: string;
    paymentId: string;
    orderId?: string;
  }): Promise<ReceiptResult> {
    const data: any = await this.request("GET", `/v2/payments/${params.paymentId}`);
    return {
      orderId: data.payment?.order_id ?? params.orderId ?? "",
      paymentId: params.paymentId,
      receiptUrl: data.payment?.receipt_url,
    };
  }
}
