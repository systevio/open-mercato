/**
 * @jest-environment jsdom
 *
 * The line dialog under the two market price presentations and the two tax provider cases.
 *
 * Continuation of decision D7 of `.ai/specs/2026-09-18-market-display-profile.md` and of
 * `.ai/specs/2026-09-19-pluggable-tax-providers.md`. Two independent switches decide what the
 * dialog asks for:
 *
 *  1. `price_presentation = single_price_plus_tax` removes the net/gross choice entirely. The one
 *     field is "Price" and is always the net amount, because a US document carries one price plus
 *     a separate tax line. Under `dual_net_gross` the dialog is unchanged.
 *  2. An external tax provider computes tax from the document's addresses after the line is
 *     written, so the per-line tax class is not the user's choice. The selector is dropped and the
 *     line silently keeps whatever class it inherited; the built in provider keeps the selector.
 *
 * The four combinations are asserted separately because the two switches are genuinely
 * independent: a US organization can be on the built in table rates, and an EU one on an external
 * provider.
 */
import * as React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import { LEGACY_DISPLAY_DEFAULTS } from '@open-mercato/shared/lib/display/profile'
import type {
  CrudCustomField,
  CrudCustomFieldRenderProps,
  CrudField,
} from '@open-mercato/ui/backend/CrudForm'

type FormValues = Record<string, unknown>
type SubmitHandler = (values: FormValues) => Promise<void>

const mockApiCall = jest.fn()
const mockCreateCrud = jest.fn()
const mockUpdateCrud = jest.fn()
const mockDisplayProfile = jest.fn<DisplayProfile | null, []>(() => null)

let capturedFields: CrudField[] = []
let capturedSubmit: SubmitHandler | null = null
let formValues: FormValues = {}

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCall: (...args: unknown[]) => mockApiCall(...args),
  withScopedApiRequestHeaders: async (
    _headers: unknown,
    operation: () => Promise<unknown>,
  ) => operation(),
}))

jest.mock('@open-mercato/ui/backend/utils/optimisticLock', () => ({
  buildOptimisticLockHeader: () => ({}),
}))

jest.mock('@open-mercato/ui/backend/utils/crud', () => ({
  createCrud: (...args: unknown[]) => mockCreateCrud(...args),
  updateCrud: (...args: unknown[]) => mockUpdateCrud(...args),
}))

jest.mock('@open-mercato/ui/backend/utils/serverErrors', () => ({
  createCrudFormError: (message: string) => new Error(message),
}))

jest.mock('@open-mercato/ui/backend/utils/customFieldValues', () => ({
  collectCustomFieldValues: () => ({}),
}))

jest.mock('../optimisticLock', () => ({
  handleSectionMutationError: () => false,
}))

jest.mock('@open-mercato/ui/hooks/useDialogKeyHandler', () => ({
  useDialogKeyHandler: () => () => {},
}))

// The profile is what the presentation switch reads; `showsSinglePricePlusTax` itself stays real
// so a change to its mapping fails here rather than passing against a mocked verdict.
jest.mock('@open-mercato/ui/backend/markets/MarketProfileProvider', () => ({
  useDisplayProfile: () => mockDisplayProfile(),
}))

type ChildrenProps = { children?: React.ReactNode }

jest.mock('@open-mercato/ui/primitives/dialog', () => ({
  Dialog: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogContent: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogHeader: ({ children }: ChildrenProps) => <div>{children}</div>,
  DialogTitle: ({ children }: ChildrenProps) => <h3>{children}</h3>,
}))

jest.mock('@open-mercato/ui/primitives/alert', () => ({
  Alert: ({ children }: ChildrenProps) => <div role="status">{children}</div>,
  AlertDescription: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertTitle: ({ children }: ChildrenProps) => <strong>{children}</strong>,
}))

jest.mock('@open-mercato/ui/primitives/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

jest.mock('@open-mercato/ui/primitives/select', () => {
  type TriggerProps = ChildrenProps & React.ButtonHTMLAttributes<HTMLButtonElement>
  return {
    __esModule: true,
    Select: ({ children }: ChildrenProps) => <div>{children}</div>,
    SelectTrigger: ({ children, ...props }: TriggerProps) => (
      <button type="button" role="combobox" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: React.ReactNode }) => (
      <span>{placeholder ?? ''}</span>
    ),
    SelectContent: ({ children }: ChildrenProps) => <div>{children}</div>,
    SelectItem: ({ children }: ChildrenProps) => <div>{children}</div>,
  }
})

// A stateful harness rather than the real CrudForm: the assertions are about which fields the
// dialog builds and what its submit handler writes, and the state lets a test read back the
// values the dialog seeded.
jest.mock('@open-mercato/ui/backend/CrudForm', () => {
  const ReactLib = require('react') as typeof import('react')
  type HarnessProps = {
    fields?: CrudField[]
    initialValues?: FormValues
    onSubmit: SubmitHandler
  }
  const isCustomField = (field: CrudField): field is CrudCustomField =>
    field.type === 'custom' && typeof field.component === 'function'

  const CrudFormHarness = ({ fields = [], initialValues = {}, onSubmit }: HarnessProps) => {
    const [values, setValues] = ReactLib.useState<FormValues>(initialValues)
    ReactLib.useEffect(() => {
      setValues(initialValues)
    }, [initialValues])

    capturedFields = fields
    capturedSubmit = onSubmit
    formValues = values

    const setFormValue = ReactLib.useCallback((id: string, next: unknown) => {
      setValues((current) => ({ ...current, [id]: next }))
    }, [])

    return (
      <form>
        {fields.filter(isCustomField).map((field) => {
          const renderProps: CrudCustomFieldRenderProps = {
            id: field.id,
            value: values[field.id],
            values,
            setValue: (next: unknown) => setFormValue(field.id, next),
            setFormValue,
          }
          return (
            <div key={field.id} data-testid={`field-${field.id}`}>
              {field.component(renderProps)}
            </div>
          )
        })}
      </form>
    )
  }

  return { __esModule: true, CrudForm: CrudFormHarness }
})

const translate = (key: string, fallback?: unknown, params?: Record<string, unknown>) => {
  const base = typeof fallback === 'string' ? fallback : key
  if (!params) return base
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.split(`{{${name}}}`).join(String(value)),
    base,
  )
}
const organizationScope = { organizationId: 'org-1', tenantId: 'tenant-1' }

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => translate,
  useLocale: () => 'en-US',
}))

jest.mock('@open-mercato/shared/lib/frontend/useOrganizationScope', () => ({
  useOrganizationScopeDetail: () => organizationScope,
  useOrganizationScopeVersion: () => 0,
}))

jest.mock('lucide-react', () => {
  const IconStub = () => null
  return {
    __esModule: true,
    Check: IconStub,
    DollarSign: IconStub,
    Loader2: IconStub,
    Search: IconStub,
    Settings: IconStub,
    X: IconStub,
  }
})

jest.mock('@open-mercato/core/modules/dictionaries/components/dictionaryAppearance', () => ({
  DictionaryValue: () => null,
  renderDictionaryIcon: () => null,
  renderDictionaryColor: () => null,
}))

import { LineItemDialog } from '../LineItemDialog'

const US_PROFILE: DisplayProfile = {
  ...LEGACY_DISPLAY_DEFAULTS,
  code: 'us',
  currencyCode: 'USD',
  pricePresentation: 'single_price_plus_tax',
}

const EU_PROFILE: DisplayProfile = {
  ...LEGACY_DISPLAY_DEFAULTS,
  code: 'eu',
  pricePresentation: 'dual_net_gross',
}

const TAX_RATE_PERCENT = 20
const PRICE_LABEL = 'Price'
const UNIT_PRICE_LABEL = 'Unit price'
const TAX_PROVIDER_HELPER =
  'Tax is calculated by the selected tax provider when the line is saved.'

type Scenario = { profile: DisplayProfile; providerKey: string }

const apiResponses = (providerKey: string) => (url: string) => {
  if (url.startsWith('/api/sales/settings/tax-provider')) return { providerKey }
  if (url.startsWith('/api/sales/tax-rates')) {
    return {
      items: [
        { id: 'tax-rate-1', name: 'Standard', code: 'STD', rate: TAX_RATE_PERCENT, is_default: true },
      ],
    }
  }
  return { items: [] }
}

const renderDialog = async ({ profile, providerKey }: Scenario) => {
  mockDisplayProfile.mockReturnValue(profile)
  mockApiCall.mockImplementation(async (url: string) => ({
    ok: true,
    result: apiResponses(providerKey)(url),
  }))
  const view = render(
    <LineItemDialog
      open
      kind="order"
      documentId="order-1"
      currencyCode="USD"
      organizationId="org-1"
      tenantId="tenant-1"
      onOpenChange={() => {}}
      onSaved={async () => {}}
    />,
  )
  // The provider selection and the tax rates are both read asynchronously on open, so every
  // assertion below has to wait for the field list to settle on its final shape.
  await waitFor(() => {
    expect(mockApiCall).toHaveBeenCalledWith(
      '/api/sales/settings/tax-provider',
      undefined,
      expect.anything(),
    )
  })
  await act(async () => {})
  return view
}

const fieldIds = () => capturedFields.map((field) => field.id)

const fieldLabel = (id: string) => capturedFields.find((field) => field.id === id)?.label

const unitPriceHasModeSwitch = (container: HTMLElement) => {
  const field = container.querySelector('[data-testid="field-unitPrice"]')
  if (!field) throw new Error('[internal] the unit price field did not render')
  return field.querySelector('button[role="combobox"]') !== null
}

// A custom line keeps the fixture free of catalog lookups: the payload maths and the field list
// are what these cases are about, not the product picker.
const lineValues = (overrides: FormValues = {}): FormValues => ({
  lineMode: 'custom',
  name: 'Custom line',
  quantity: '2',
  quantityUnit: 'pcs',
  // A stored `gross` is deliberate on the US cases: the dialog must override it rather than
  // trusting whatever the form state happened to carry.
  priceMode: 'gross',
  unitPrice: '100',
  taxRate: TAX_RATE_PERCENT,
  taxRateId: 'tax-rate-1',
  currencyCode: 'USD',
  ...overrides,
})

const submit = async (values: FormValues) => {
  await act(async () => {
    await capturedSubmit?.(values)
  })
  expect(mockCreateCrud).toHaveBeenCalledTimes(1)
  return mockCreateCrud.mock.calls[0][1] as FormValues
}

describe('LineItemDialog under price presentation and tax provider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedFields = []
    capturedSubmit = null
    formValues = {}
    mockDisplayProfile.mockReturnValue(null)
    mockCreateCrud.mockResolvedValue({ ok: true })
    mockUpdateCrud.mockResolvedValue({ ok: true })
  })

  describe('dual_net_gross (unchanged)', () => {
    it('keeps the net/gross switch, the "Unit price" label and the tax class selector', async () => {
      const { container } = await renderDialog({ profile: EU_PROFILE, providerKey: 'table-rates' })

      expect(unitPriceHasModeSwitch(container)).toBe(true)
      expect(fieldLabel('unitPrice')).toBe(UNIT_PRICE_LABEL)
      expect(fieldIds()).toContain('taxRateId')
      expect(container.textContent).not.toContain(TAX_PROVIDER_HELPER)
    })

    it('still stores a gross entry as gross', async () => {
      await renderDialog({ profile: EU_PROFILE, providerKey: 'table-rates' })

      const payload = await submit(lineValues())
      expect(payload.priceMode).toBe('gross')
      expect(payload.unitPriceGross).toBeCloseTo(100)
      expect(payload.unitPriceNet).toBeCloseTo(100 / 1.2)
    })
  })

  describe('single_price_plus_tax', () => {
    it('drops the net/gross switch and labels the single field "Price"', async () => {
      const { container } = await renderDialog({ profile: US_PROFILE, providerKey: 'table-rates' })

      expect(unitPriceHasModeSwitch(container)).toBe(false)
      expect(fieldLabel('unitPrice')).toBe(PRICE_LABEL)
    })

    it('stores the single field as the net amount whatever the form state says', async () => {
      await renderDialog({ profile: US_PROFILE, providerKey: 'table-rates' })

      const payload = await submit(lineValues())
      expect(payload.priceMode).toBe('net')
      expect(payload.unitPriceNet).toBeCloseTo(100)
      expect(payload.unitPriceGross).toBeCloseTo(120)
      expect(payload.totalNetAmount).toBeCloseTo(200)
      expect((payload.metadata as FormValues).priceMode).toBe('net')
    })

    it('seeds a new line in net mode rather than the legacy gross default', async () => {
      await renderDialog({ profile: US_PROFILE, providerKey: 'table-rates' })

      expect(formValues.priceMode).toBe('net')
    })

    it('keeps the tax class selector while the built in provider is selected', async () => {
      await renderDialog({ profile: US_PROFILE, providerKey: 'table-rates' })

      expect(fieldIds()).toContain('taxRateId')
    })
  })

  describe('external tax provider', () => {
    it('drops the tax class selector and explains who computes the tax', async () => {
      const { container } = await renderDialog({ profile: EU_PROFILE, providerKey: 'avalara' })

      expect(fieldIds()).not.toContain('taxRateId')
      expect(container.textContent).toContain(TAX_PROVIDER_HELPER)
      // The provider switch is independent of the presentation: an EU organization on an external
      // provider keeps its net/gross choice.
      expect(unitPriceHasModeSwitch(container)).toBe(true)
    })

    it('drops both controls under single_price_plus_tax', async () => {
      const { container } = await renderDialog({ profile: US_PROFILE, providerKey: 'avalara' })

      expect(fieldIds()).not.toContain('taxRateId')
      expect(unitPriceHasModeSwitch(container)).toBe(false)
      expect(container.textContent).toContain(TAX_PROVIDER_HELPER)
    })

    it('still saves the tax class the line inherited from its product', async () => {
      await renderDialog({ profile: US_PROFILE, providerKey: 'avalara' })

      const payload = await submit(lineValues({ taxRateId: 'tax-rate-1' }))
      expect((payload.metadata as FormValues).taxRateId).toBe('tax-rate-1')
      expect(payload.taxRate).toBe(TAX_RATE_PERCENT)
    })

    it('saves no tax class for a product that carries none', async () => {
      await renderDialog({ profile: US_PROFILE, providerKey: 'avalara' })

      const payload = await submit(lineValues({ taxRateId: null, taxRate: null }))
      expect((payload.metadata as FormValues).taxRateId).toBeUndefined()
      // A line with no class carries the unchanged zero rate the built in fallback already
      // writes; the provider replaces it on the server when the document recalculates.
      expect(payload.taxRate).toBe(0)
    })

    it('does not seed the organization default tax class into a fresh line', async () => {
      const { rerender } = await renderDialog({ profile: US_PROFILE, providerKey: 'avalara' })

      // Reopening is what makes the assertion deterministic: the tax rates are loaded
      // asynchronously on the first open, so only the second reset sees the default rate the
      // built in path would have seeded.
      await act(async () => {
        rerender(
          <LineItemDialog
            open={false}
            kind="order"
            documentId="order-1"
            currencyCode="USD"
            organizationId="org-1"
            tenantId="tenant-1"
            onOpenChange={() => {}}
            onSaved={async () => {}}
          />,
        )
      })
      await act(async () => {
        rerender(
          <LineItemDialog
            open
            kind="order"
            documentId="order-1"
            currencyCode="USD"
            organizationId="org-1"
            tenantId="tenant-1"
            onOpenChange={() => {}}
            onSaved={async () => {}}
          />,
        )
      })

      expect(formValues.taxRateId).toBeNull()
    })

    it('seeds the organization default tax class when the built in provider is selected', async () => {
      const { rerender } = await renderDialog({ profile: US_PROFILE, providerKey: 'table-rates' })

      await act(async () => {
        rerender(
          <LineItemDialog
            open={false}
            kind="order"
            documentId="order-1"
            currencyCode="USD"
            organizationId="org-1"
            tenantId="tenant-1"
            onOpenChange={() => {}}
            onSaved={async () => {}}
          />,
        )
      })
      await act(async () => {
        rerender(
          <LineItemDialog
            open
            kind="order"
            documentId="order-1"
            currencyCode="USD"
            organizationId="org-1"
            tenantId="tenant-1"
            onOpenChange={() => {}}
            onSaved={async () => {}}
          />,
        )
      })

      expect(formValues.taxRateId).toBe('tax-rate-1')
    })
  })

  describe('an unreadable provider selection', () => {
    it('keeps the tax class selector when the settings read is forbidden', async () => {
      mockDisplayProfile.mockReturnValue(EU_PROFILE)
      mockApiCall.mockImplementation(async (url: string) => {
        if (url.startsWith('/api/sales/settings/tax-provider')) {
          return { ok: false, status: 403, result: null }
        }
        return { ok: true, result: apiResponses('table-rates')(url) }
      })
      const { container } = render(
        <LineItemDialog
          open
          kind="order"
          documentId="order-1"
          currencyCode="USD"
          organizationId="org-1"
          tenantId="tenant-1"
          onOpenChange={() => {}}
          onSaved={async () => {}}
        />,
      )
      await act(async () => {})

      expect(fieldIds()).toContain('taxRateId')
      expect(container.textContent).not.toContain(TAX_PROVIDER_HELPER)
    })
  })
})
