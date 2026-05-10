export type PaymentCheckout = {
  provider: string;
  providerPaymentId: string;
  paymentUrl: string | null;
  status: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentGateway {
  createCheckout(input: {
    bookingId: number;
    paymentId: number;
    type: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<PaymentCheckout>;
}

class PlaceholderPaymentGateway implements PaymentGateway {
  async createCheckout(input: {
    bookingId: number;
    paymentId: number;
    type: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<PaymentCheckout> {
    return {
      provider: process.env.PAYMENT_PROVIDER || "manual",
      providerPaymentId: `manual-${input.paymentId}`,
      paymentUrl: null,
      status: "pending",
      metadata: {
        bookingId: input.bookingId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
    };
  }
}

export const paymentGateway: PaymentGateway = new PlaceholderPaymentGateway();
