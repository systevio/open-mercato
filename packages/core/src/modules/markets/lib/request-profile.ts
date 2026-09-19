import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { DisplayProfile } from '@open-mercato/shared/lib/display/profile'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { DisplayProfileResolver } from './resolve-display-profile'

const logger = createLogger('markets').child({ component: 'request-profile' })

/**
 * The signed-in caller's market display profile, for a server component.
 *
 * Returns `null` for an anonymous visitor, for an organization that never picked a market, and
 * when the `markets` module is not installed - all three mean the same thing to a consumer: render
 * the legacy defaults. Never throws: a display setting must not be able to break a page render.
 */
export async function resolveDisplayProfileForRequest(): Promise<DisplayProfile | null> {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId || !auth.orgId) return null
    const container = await createRequestContainer()
    let resolver: DisplayProfileResolver
    try {
      resolver = container.resolve<DisplayProfileResolver>('displayProfileResolver')
    } catch {
      // Soft-optional peer: without `markets` there is no resolver, and no market.
      return null
    }
    return await resolver.resolve({ tenantId: auth.tenantId, organizationId: auth.orgId })
  } catch (error) {
    logger.warn('Failed to resolve the display profile for this request', { err: error })
    return null
  }
}
