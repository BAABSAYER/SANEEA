export type ErpSyncResult = {
  provider: string;
  enabled: boolean;
  status: "skipped" | "synced" | "failed";
  halId?: string;
  externalId?: string;
  warnings?: string[];
  metadata?: Record<string, unknown>;
};

type HalEnvelope = {
  ok: boolean;
  halId?: string;
  externalId?: string;
  sourceApp?: string;
  sourceTenantId?: string;
  warnings?: string[];
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export interface ErpGateway {
  ping(): Promise<ErpSyncResult>;
  verifyTenant(): Promise<ErpSyncResult>;
  upsertCustomer(input: {
    externalId: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ErpSyncResult>;
  createLead(input: {
    externalId: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ErpSyncResult>;
  createInvoice(input: {
    externalId: string;
    customerExternalId?: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ErpSyncResult>;
  createPayment(input: {
    externalId: string;
    invoiceExternalId?: string;
    amount: number;
    currency?: string;
    method?: string;
    paidAt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ErpSyncResult>;
  postActivity(input: {
    externalId: string;
    eventType: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ErpSyncResult>;
}

class DisabledErpGateway implements ErpGateway {
  private skip(reason: string, metadata?: Record<string, unknown>): ErpSyncResult {
    return {
      provider: process.env.ERP_PROVIDER || "disabled",
      enabled: false,
      status: "skipped",
      metadata: { reason, ...metadata },
    };
  }

  async ping() { return this.skip("ERP integration is not configured"); }
  async verifyTenant() { return this.skip("ERP integration is not configured"); }
  async upsertCustomer(input: { externalId: string }) { return this.skip("ERP integration is not configured", { externalId: input.externalId }); }
  async createLead(input: { externalId: string }) { return this.skip("ERP integration is not configured", { externalId: input.externalId }); }
  async createInvoice(input: { externalId: string }) { return this.skip("ERP integration is not configured", { externalId: input.externalId }); }
  async createPayment(input: { externalId: string }) { return this.skip("ERP integration is not configured", { externalId: input.externalId }); }
  async postActivity(input: { externalId: string }) { return this.skip("ERP integration is not configured", { externalId: input.externalId }); }
}

class HalErpGateway implements ErpGateway {
  private readonly apiKey = process.env.HAL_API_KEY || "";
  private readonly baseUrl = (process.env.HAL_BASE_URL || "").replace(/\/+$/, "");
  private readonly externalTenantId = process.env.HAL_EXTERNAL_TENANT_ID || "saneea";

  async ping() {
    return this.request("GET", "/ping", undefined, undefined, false);
  }

  async verifyTenant() {
    return this.request("GET", `/ping/${encodeURIComponent(this.externalTenantId)}`, undefined, undefined, false);
  }

  async upsertCustomer(input: {
    externalId: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("POST", "/customers/upsert", {
      externalTenantId: this.externalTenantId,
      externalId: input.externalId,
      name: input.name,
      mobile: input.mobile || undefined,
      email: input.email || undefined,
      metadata: input.metadata,
    }, `customer-${input.externalId}`);
  }

  async createLead(input: {
    externalId: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("POST", "/leads", {
      externalTenantId: this.externalTenantId,
      externalId: input.externalId,
      name: input.name,
      mobile: input.mobile || undefined,
      email: input.email || undefined,
      source: input.source || "saneea",
      metadata: input.metadata,
    }, `lead-${input.externalId}`);
  }

  async createInvoice(input: {
    externalId: string;
    customerExternalId?: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("POST", "/invoices", {
      externalTenantId: this.externalTenantId,
      externalId: input.externalId,
      customerExternalId: input.customerExternalId,
      amount: input.amount,
      currency: input.currency || "SAR",
      description: input.description,
      metadata: input.metadata,
    }, `invoice-${input.externalId}`);
  }

  async createPayment(input: {
    externalId: string;
    invoiceExternalId?: string;
    amount: number;
    currency?: string;
    method?: string;
    paidAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("POST", "/payments", {
      externalTenantId: this.externalTenantId,
      externalId: input.externalId,
      invoiceExternalId: input.invoiceExternalId,
      amount: input.amount,
      currency: input.currency || "SAR",
      method: input.method || "online",
      paidAt: input.paidAt,
      metadata: input.metadata,
    }, `payment-${input.externalId}`);
  }

  async postActivity(input: {
    externalId: string;
    eventType: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request("POST", "/activity", {
      externalTenantId: this.externalTenantId,
      externalId: input.externalId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
    }, `activity-${input.externalId}`);
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
    requireTenant = true,
  ): Promise<ErpSyncResult> {
    if (!this.baseUrl || !this.apiKey) {
      return {
        provider: "hal",
        enabled: false,
        status: "skipped",
        metadata: { reason: "HAL_BASE_URL and HAL_API_KEY are required" },
      };
    }

    if (requireTenant && !this.externalTenantId) {
      return {
        provider: "hal",
        enabled: false,
        status: "skipped",
        metadata: { reason: "HAL_EXTERNAL_TENANT_ID is required" },
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["X-HAL-Idempotency-Key"] = idempotencyKey;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await this.parseResponse(response);
    if (!response.ok || payload.ok === false) {
      console.error("HAL ERP sync failed:", {
        path,
        status: response.status,
        error: payload.error,
      });
      return {
        provider: "hal",
        enabled: true,
        status: "failed",
        externalId: payload.externalId || String(body?.externalId || ""),
        warnings: payload.warnings || [],
        metadata: {
          httpStatus: response.status,
          error: payload.error,
        },
      };
    }

    return {
      provider: "hal",
      enabled: true,
      status: "synced",
      halId: payload.halId,
      externalId: payload.externalId || String(body?.externalId || ""),
      warnings: payload.warnings || [],
      metadata: {
        sourceApp: payload.sourceApp,
        sourceTenantId: payload.sourceTenantId,
      },
    };
  }

  private async parseResponse(response: Response): Promise<HalEnvelope> {
    const text = await response.text();
    if (!text) return { ok: response.ok };
    try {
      return JSON.parse(text) as HalEnvelope;
    } catch {
      return {
        ok: response.ok,
        error: {
          code: "INVALID_RESPONSE",
          message: text,
        },
      };
    }
  }
}

function createErpGateway(): ErpGateway {
  if ((process.env.ERP_PROVIDER || "").toLowerCase() === "hal") {
    return new HalErpGateway();
  }
  return new DisabledErpGateway();
}

export const erpGateway: ErpGateway = createErpGateway();
