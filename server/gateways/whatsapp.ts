export type WhatsAppSendResult = {
  provider: string;
  providerMessageId: string;
  status: string;
  metadata?: Record<string, unknown>;
};

export interface WhatsAppGateway {
  sendMessage(input: {
    to: string;
    body: string;
    context?: Record<string, unknown>;
  }): Promise<WhatsAppSendResult>;
}

class PlaceholderWhatsAppGateway implements WhatsAppGateway {
  async sendMessage(input: {
    to: string;
    body: string;
    context?: Record<string, unknown>;
  }): Promise<WhatsAppSendResult> {
    return {
      provider: process.env.WHATSAPP_PROVIDER || "manual",
      providerMessageId: `manual-${Date.now()}`,
      status: "queued",
      metadata: {
        to: input.to,
        body: input.body,
        context: input.context,
      },
    };
  }
}

class UltraMsgWhatsAppGateway implements WhatsAppGateway {
  private readonly instance = process.env.ULTRAMSG_INSTANCE || "";
  private readonly token = process.env.ULTRAMSG_TOKEN || "";
  private readonly baseUrl = (
    process.env.ULTRAMSG_BASE_URL ||
    (this.instance ? `https://api.ultramsg.com/${this.instance}` : "")
  ).replace(/\/+$/, "");

  async sendMessage(input: {
    to: string;
    body: string;
    context?: Record<string, unknown>;
  }): Promise<WhatsAppSendResult> {
    if (!this.baseUrl || !this.token) {
      throw new Error("ULTRAMSG_BASE_URL/ULTRAMSG_INSTANCE and ULTRAMSG_TOKEN are required when WHATSAPP_PROVIDER=ultramsg");
    }

    const body = new URLSearchParams({
      token: this.token,
      to: input.to,
      body: input.body,
    });

    const response = await fetch(`${this.baseUrl}/messages/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const responseText = await response.text();
    const payload = this.parsePayload(responseText);

    if (!response.ok || this.isFailedPayload(payload)) {
      console.error("UltraMsg WhatsApp send failed:", {
        status: response.status,
        payload,
      });
      throw new Error("UltraMsg WhatsApp send failed");
    }

    return {
      provider: "ultramsg",
      providerMessageId: this.getProviderMessageId(payload),
      status: this.getStatus(payload),
      metadata: {
        ...this.payloadToObject(payload),
        context: input.context,
      },
    };
  }

  private parsePayload(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private payloadToObject(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
    return { payload };
  }

  private getProviderMessageId(payload: unknown): string {
    const data = this.payloadToObject(payload);
    return String(data.id || data.messageId || data.message_id || data.referenceId || data.reference_id || Date.now());
  }

  private getStatus(payload: unknown): string {
    const data = this.payloadToObject(payload);
    if (typeof data.status === "string") return data.status;
    if (data.sent === true || data.sent === "true") return "sent";
    if (data.success === true || data.success === "true") return "sent";
    return "queued";
  }

  private isFailedPayload(payload: unknown): boolean {
    const data = this.payloadToObject(payload);
    return (
      data.error === true ||
      data.success === false ||
      data.sent === false ||
      typeof data.error === "string" ||
      typeof data.message === "string" && data.message.toLowerCase().includes("error")
    );
  }
}

function createWhatsAppGateway(): WhatsAppGateway {
  if ((process.env.WHATSAPP_PROVIDER || "").toLowerCase() === "ultramsg") {
    return new UltraMsgWhatsAppGateway();
  }
  return new PlaceholderWhatsAppGateway();
}

export const whatsappGateway: WhatsAppGateway = createWhatsAppGateway();
