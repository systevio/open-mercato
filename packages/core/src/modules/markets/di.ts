import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/core'
import type { CacheStrategy } from '@open-mercato/cache'
import { CachedDisplayProfileResolver } from './lib/resolve-display-profile'

export function register(container: AppContainer) {
  container.register({
    displayProfileResolver: {
      resolve: (c) => {
        const em = c.resolve<EntityManager>('em')
        let cache: CacheStrategy | null = null
        try {
          cache = c.resolve<CacheStrategy>('cache')
        } catch {
          // The resolver stays usable without a cache; it just reads through on every request.
          cache = null
        }
        return new CachedDisplayProfileResolver(em, cache)
      },
    },
  })
}
