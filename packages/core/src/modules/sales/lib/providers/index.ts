import { ensureProviderTotalsCalculator } from './totals'
import { registerDefaultSalesProviders } from './defaultProviders'

registerDefaultSalesProviders()
ensureProviderTotalsCalculator()

export {
  getPaymentProvider,
  getShippingProvider,
  getTaxProvider,
  listPaymentProviders,
  listShippingProviders,
  listTaxProviders,
  normalizeProviderSettings,
  registerPaymentProvider,
  registerShippingProvider,
  registerTaxProvider,
} from './registry'
export { registerStripeProvider } from './defaultProviders'

export type {
  PaymentProvider,
  PaymentProviderCalculateInput,
  PaymentMethodContext,
  ProviderAdjustment,
  ProviderAdjustmentResult,
  ProviderSettingField,
  ProviderSettingsDefinition,
  ShippingMetrics,
  ShippingMethodContext,
  ShippingProvider,
  ShippingProviderCalculateInput,
  TaxAddress,
  TaxCalculationRequest,
  TaxCalculationStatus,
  TaxCustomer,
  TaxCustomerExemption,
  TaxDocumentContext,
  TaxDocumentIntent,
  TaxInfoLike,
  TaxJurisdictionAmount,
  TaxProductFacts,
  TaxProvider,
  TaxProviderCalculateInput,
  TaxProviderCalculateResult,
  TaxProviderCapabilities,
  TaxProviderChargeResult,
  TaxProviderLineResult,
  TaxProviderMessage,
  TaxProviderResultStatus,
  TaxProviderSelection,
  TaxRequestCharge,
  TaxRequestLine,
  TaxTransactionLifecycleInput,
  TaxTransactionState,
} from './types'
