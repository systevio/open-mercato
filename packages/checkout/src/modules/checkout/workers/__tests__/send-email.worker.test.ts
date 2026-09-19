const sendEmail = jest.fn()
const findOneWithDecryption = jest.fn()
const resolveNotificationDeliveryConfig = jest.fn()
const displayProfileResolver = { resolve: jest.fn() }

jest.mock('@open-mercato/shared/lib/email/send', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}))

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findOneWithDecryption: (...args: unknown[]) => findOneWithDecryption(...args),
}))

jest.mock('@open-mercato/core/modules/notifications/lib/deliveryConfig', () => ({
  DEFAULT_NOTIFICATION_DELIVERY_CONFIG: {
    panelPath: '/backend/notifications',
    strategies: {
      database: { enabled: true },
      email: { enabled: true },
      custom: {},
    },
  },
  resolveNotificationDeliveryConfig: (...args: unknown[]) => resolveNotificationDeliveryConfig(...args),
}))

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: jest.fn().mockResolvedValue({
    t: (_key: string, fallback?: string, vars?: Record<string, string>) => {
      if (!fallback) return _key
      if (!vars) return fallback
      return fallback.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
    },
  }),
}))

jest.mock('../../emails/PaymentStartEmail', () => ({
  __esModule: true,
  default: jest.fn((props: unknown) => props),
}))

jest.mock('../../emails/PaymentSuccessEmail', () => ({
  __esModule: true,
  default: jest.fn((props: unknown) => props),
}))

jest.mock('../../emails/PaymentErrorEmail', () => ({
  __esModule: true,
  default: jest.fn((props: unknown) => props),
}))

describe('checkout send-email worker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resolveNotificationDeliveryConfig.mockResolvedValue({
      panelPath: '/backend/notifications',
      strategies: {
        database: { enabled: true },
        email: {
          enabled: true,
          from: 'notifications@example.com',
          replyTo: 'reply@example.com',
        },
        custom: {},
      },
    })
    displayProfileResolver.resolve.mockResolvedValue({
      code: 'us',
      name: 'United States',
      languageTag: 'en-US',
      currencyCode: 'USD',
      currencyDisplay: 'symbol',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      negativeStyle: 'minus',
      dateFormat: 'MM/dd/yyyy',
      dateTimeFormat: 'MM/dd/yyyy h:mm a',
      timeFormat: 'h:mm a',
      hourCycle: 'h12',
      firstDayOfWeek: 0,
      timeZone: 'America/Chicago',
      addressLayout: 'us',
      defaultCountryCode: 'US',
      subdivisionRequired: true,
      postalCodePattern: '^\\d{5}(-\\d{4})?$',
      postalCodeLabelKey: 'markets.address.label.zipCode',
      subdivisionLabelKey: 'markets.address.label.state',
      addressLine2LabelKey: 'markets.address.label.aptSuiteUnit',
      phoneNationalPattern: '(###) ###-####',
      phoneDefaultDialCode: '+1',
      measurementSystem: 'us_customary',
      defaultWeightUnit: 'lb',
      defaultLengthUnit: 'in',
      lengthDisplay: 'feet_inches',
      paperSize: 'letter',
      pricePresentation: 'single_price_plus_tax',
      taxLineLabelKey: 'markets.tax.label.salesTax',
      taxNoteKey: 'markets.tax.note.calculatedAtOrder',
    })
  })

  it('uses notification delivery sender settings for checkout emails', async () => {
    findOneWithDecryption
      .mockResolvedValueOnce({
        id: 'txn-1',
        linkId: 'link-1',
        email: 'buyer@example.com',
        firstName: 'Piotr',
        amount: '33.00',
        currencyCode: 'USD',
      })
      .mockResolvedValueOnce({
        id: 'link-1',
        title: 'Spring Gala 2026',
        name: 'Spring Gala 2026',
        successEmailSubject: 'Your Spring Gala ticket is confirmed',
        successEmailBody: null,
        sendSuccessEmail: true,
      })

    const { default: handle } = await import('../send-email.worker')

    await handle(
      {
        payload: {
          type: 'success',
          transactionId: 'txn-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        },
      } as never,
      {
        resolve: (name: string) => {
          if (name === 'em') return { fork: () => ({}) }
          if (name === 'displayProfileResolver') return displayProfileResolver
          throw new Error(`Missing dependency: ${name}`)
        },
      } as never,
    )

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        from: 'notifications@example.com',
        replyTo: 'reply@example.com',
        subject: 'Your Spring Gala ticket is confirmed',
      }),
    )
    expect(sendEmail.mock.calls[0]?.[0]?.react).toEqual(expect.objectContaining({
      amount: '$33.00',
      currencyCode: 'USD',
    }))
  })
})
