import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import { prefetchAllRoutes, prefetchRoute } from '../prefetch'

const Eager = defineComponent({ name: 'EagerPage', render: () => null })

function makeRouter() {
  const loaders = {
    home: vi.fn<() => Promise<unknown>>(async () => ({ default: Eager })),
    products: vi.fn<() => Promise<unknown>>(async () => ({ default: Eager })),
    tanda: vi.fn<() => Promise<unknown>>(async () => ({ default: Eager })),
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: loaders.home },
      { path: '/products', component: loaders.products },
      { path: '/tandas/:id', component: loaders.tanda },
      { path: '/settings', component: Eager },
    ],
  })
  return { router, loaders }
}

describe('route prefetching', () => {
  it('loads the chunk of a hovered route once', async () => {
    const { router, loaders } = makeRouter()

    await prefetchRoute(router, '/products')
    await prefetchRoute(router, '/products')

    expect(loaders.products).toHaveBeenCalledTimes(1)
    expect(loaders.home).not.toHaveBeenCalled()
  })

  it('loads every lazy route chunk and skips eager components', async () => {
    const { router, loaders } = makeRouter()

    await prefetchAllRoutes(router)

    expect(loaders.home).toHaveBeenCalledTimes(1)
    expect(loaders.products).toHaveBeenCalledTimes(1)
    expect(loaders.tanda).toHaveBeenCalledTimes(1)
  })

  it('never rejects when a chunk fails to load', async () => {
    const { router, loaders } = makeRouter()
    loaders.products.mockRejectedValueOnce(new Error('offline'))

    await expect(prefetchRoute(router, '/products')).resolves.toBeUndefined()
    // A failed prefetch can be retried later.
    await prefetchRoute(router, '/products')
    expect(loaders.products).toHaveBeenCalledTimes(2)
  })
})
