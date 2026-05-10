export type PushNotificationResult = {
  provider: string;
  status: string;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
};

export interface PushNotificationGateway {
  sendToTokens(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<PushNotificationResult[]>;
}

class PlaceholderPushNotificationGateway implements PushNotificationGateway {
  async sendToTokens(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<PushNotificationResult[]> {
    return input.tokens.map((token) => ({
      provider: process.env.PUSH_PROVIDER || "manual",
      providerMessageId: `manual-${Date.now()}-${token.slice(-6)}`,
      status: "queued",
      metadata: {
        token,
        title: input.title,
        body: input.body,
        data: input.data,
      },
    }));
  }
}

export const pushNotificationGateway: PushNotificationGateway = new PlaceholderPushNotificationGateway();
