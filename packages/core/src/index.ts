// Barrel for @open-mercato/core (placeholder)
export {}

/**
 * Architecture proof marker — deliberately carries no behaviour.
 *
 * Its only job is to make the provenance of an installed package assertable:
 * a standalone app that can read this constant is running packages built from
 * this fork and branch, not the ones published to the public registry.
 *
 * Remove it once the fork/publish/consume chain is no longer being proven.
 */
export const FORK_BUILD_MARKER = 'systevio/open-mercato@proof/fork-marker'
