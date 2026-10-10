/**
 * Payment Gateway Abstraction Layer
 *
 * PCI-DSS Compliance & Security Rule:
 * DO NOT collect or store raw card numbers, CVV, or card expiry dates in Firebase or local storage.
 * When a real Pakistan payment gateway (PayFast, Safepay, Bank Alfalah, Stripe) is integrated,
 * tokenization or redirect-based checkout flows MUST be used.
 *
 * Current State:
 * Direct card processing is NOT faked. When no gateway is active, users receive a clear,
 * professional notice explaining that card integration is pending banking certification,
 * directing them to Cash on Delivery, Easypaisa, or JazzCash.
 */

import { Order } from '@/types/admin';

export interface PaymentGatewayConfig {
  providerId: 'safepay' | 'payfast' | 'bank_alfalah' | 'mock';
  providerName: string;
  isConfigured: boolean;
  environment: 'sandbox' | 'production';
  supportedCurrencies: string[];
}

export interface PaymentInitiationResult {
  success: boolean;
  gatewayOrderId?: string;
  redirectUrl?: string;
  clientSecret?: string;
  error?: string;
  message?: string;
}

export interface GatewayVerificationResult {
  verified: boolean;
  transactionReference?: string;
  gatewayTransactionId?: string;
  amountPaid?: number;
  error?: string;
  rawPayload?: Record<string, unknown>;
}

export interface PaymentGateway {
  config: PaymentGatewayConfig;
  initiatePayment(order: Order): Promise<PaymentInitiationResult>;
  verifyWebhook(payload: unknown, signature?: string): Promise<GatewayVerificationResult>;
}

/**
 * Default unconfigured payment gateway provider
 * Strictly prevents fake card payment processing as per security guidelines.
 */
export class UnconfiguredCardGateway implements PaymentGateway {
  config: PaymentGatewayConfig = {
    providerId: 'safepay',
    providerName: 'PCI-DSS Certified Card Gateway',
    isConfigured: false,
    environment: 'sandbox',
    supportedCurrencies: ['PKR'],
  };

  async initiatePayment(_order: Order): Promise<PaymentInitiationResult> {
    return {
      success: false,
      error:
        'Online Credit/Debit card gateway is currently undergoing official banking PCI-DSS certification in Pakistan. Please select Cash on Delivery, Easypaisa, or JazzCash for immediate order fulfillment.',
    };
  }

  async verifyWebhook(): Promise<GatewayVerificationResult> {
    return {
      verified: false,
      error: 'Gateway not configured.',
    };
  }
}

// Active singleton instance
let activeGateway: PaymentGateway = new UnconfiguredCardGateway();

export function getActivePaymentGateway(): PaymentGateway {
  return activeGateway;
}

export function setActivePaymentGateway(gateway: PaymentGateway): void {
  activeGateway = gateway;
}

export function isCardPaymentLive(): boolean {
  return activeGateway.config.isConfigured;
}
