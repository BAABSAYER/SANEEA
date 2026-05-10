export type OtpSendResult = {
  provider: string;
  providerMessageId: string;
  status: string;
  devCode?: string;
  metadata?: Record<string, unknown>;
};

export type OtpVerifyResult = {
  provider: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
};

export interface OtpGateway {
  sendOtp(input: {
    phone: string;
    code?: string;
    purpose: string;
  }): Promise<OtpSendResult>;

  verifyOtp(input: {
    phone: string;
    code: string;
    providerMessageId?: string | null;
  }): Promise<OtpVerifyResult>;
}

class DevOtpGateway implements OtpGateway {
  async sendOtp(input: {
    phone: string;
    code?: string;
    purpose: string;
  }): Promise<OtpSendResult> {
    if (!input.code) {
      throw new Error("Dev OTP gateway requires a locally generated code");
    }
    console.log(`[OTP:${input.purpose}] ${input.phone} -> ${input.code}`);
    return {
      provider: "dev",
      providerMessageId: `dev-${Date.now()}`,
      status: "sent",
      devCode: process.env.NODE_ENV === "production" ? undefined : input.code,
      metadata: {
        phone: input.phone,
        purpose: input.purpose,
      },
    };
  }

  async verifyOtp(): Promise<OtpVerifyResult> {
    throw new Error("Dev OTP verification is handled locally");
  }
}

class AuthenticaOtpGateway implements OtpGateway {
  private readonly baseUrl = process.env.AUTHENTICA_BASE_URL || "https://api.authentica.sa";
  private readonly apiKey = process.env.AUTHENTICA_API_KEY || "";
  private readonly method = process.env.AUTHENTICA_OTP_METHOD || "sms";
  private readonly templateId = process.env.AUTHENTICA_TEMPLATE_ID;

  private get headers() {
    if (!this.apiKey) {
      throw new Error("AUTHENTICA_API_KEY is required when OTP_PROVIDER=authentica");
    }

    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Authorization": this.apiKey,
    };
  }

  async sendOtp(input: {
    phone: string;
    purpose: string;
  }): Promise<OtpSendResult> {
    const body: Record<string, string | number> = {
      method: this.method,
      phone: input.phone,
    };
    if (this.templateId) body.template_id = Number(this.templateId);

    const response = await fetch(`${this.baseUrl}/api/v2/send-otp`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logProviderError("send", response.status, payload);
      throw new Error("Authentica send OTP failed");
    }

    return {
      provider: "authentica",
      providerMessageId: String(payload.id || payload.message_id || payload.request_id || Date.now()),
      status: payload.status || (payload.success ? "sent" : "queued"),
      metadata: payload,
    };
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
  }): Promise<OtpVerifyResult> {
    const response = await fetch(`${this.baseUrl}/api/v2/verify-otp`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        phone: input.phone,
        otp: input.code,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logProviderError("verify", response.status, payload);
      throw new Error("Authentica verify OTP failed");
    }

    return {
      provider: "authentica",
      verified: this.isVerifiedPayload(payload),
      metadata: payload,
    };
  }

  private isVerifiedPayload(payload: any) {
    return (
      payload?.verified === true ||
      payload?.success === true ||
      payload?.status === true ||
      payload?.data?.verified === true ||
      payload?.data?.success === true ||
      payload?.data?.status === true ||
      payload?.data?.result === true
    );
  }

  private logProviderError(action: "send" | "verify", status: number, payload: unknown) {
    console.error("Authentica OTP provider error", {
      action,
      status,
      payload,
    });
  }
}

export const otpGateway: OtpGateway =
  process.env.OTP_PROVIDER === "authentica"
    ? new AuthenticaOtpGateway()
    : new DevOtpGateway();
