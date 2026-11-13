import { NextRequest, NextResponse } from 'next/server';
import { readPersistentPaymentConfig, computeAllowedCustomerTypes } from '@/lib/db/paymentMethodsStorage';
import { getCustomerSession } from '@/lib/db/customerSession';
import { getServerCustomerById } from '@/lib/db/customers-server';
import { PaymentMethodConfig } from '@/types/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 1. Determine customer tier strictly from verified session and DB record
    let customerType: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE' = 'RETAIL';
    const session = await getCustomerSession(request);
    if (session) {
      const fullCustomer = await getServerCustomerById(session.id);
      if (
        fullCustomer &&
        fullCustomer.status !== 'suspended' &&
        (fullCustomer as any).status !== 'inactive'
      ) {
        const ct = fullCustomer.customerType?.toUpperCase();
        if (ct === 'WHOLESALE' || ct === 'SUPER_WHOLESALE') {
          customerType = ct;
        }
      }
    }

    // 2. Load payment config
    const config = readPersistentPaymentConfig();

    // 3. Filter only methods that are enabled AND allowed for this customer tier
    const filteredMethods = config.methods
      .filter((m) => {
        if (!m.enabled) return false;
        const allowed = computeAllowedCustomerTypes(m);
        return allowed.includes(customerType);
      })
      .map((m) => {
        // Return only the fields checkout truly needs; omit security object and backend metadata
        const cleanMethod: Partial<PaymentMethodConfig> = {
          id: m.id,
          name: m.name,
          type: m.type,
          enabled: true,
          description: m.description,
          instructions: m.instructions,
          badgeText: m.badgeText,
          displayOrder: m.displayOrder,
          requiresReference: m.requiresReference,
          referenceFormat: m.referenceFormat,
          isConfigured: m.isConfigured,
          detailsHeading: m.detailsHeading,
          accountSectionHeading: m.accountSectionHeading,
          accountNameLabel: m.accountNameLabel,
          accountNumberLabel: m.accountNumberLabel,
          accountHelpText: m.accountHelpText,
          merchantName: m.merchantName,
          merchantIdentifier: m.merchantIdentifier,
          referenceLabel: m.referenceLabel,
          referencePlaceholder: m.referencePlaceholder,
          referenceHelpText: m.referenceHelpText,
          minReferenceLength: m.minReferenceLength,
          maxReferenceLength: m.maxReferenceLength,
          referenceValidationMessage: m.referenceValidationMessage,
          warningHeading: m.warningHeading,
          warningMessage: m.warningMessage,
          infoMessage: m.infoMessage,
        };
        return cleanMethod as PaymentMethodConfig;
      });

    // 4. Return strictly no-store and Vary: Cookie (no security settings object)
    return NextResponse.json(
      {
        success: true,
        customerType,
        methods: filteredMethods,
        enabledMethods: filteredMethods,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Vary': 'Cookie',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read payment methods.' },
      { status: 500 }
    );
  }
}
