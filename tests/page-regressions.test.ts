import assert from 'node:assert/strict'
import test from 'node:test'
import { mount, byClass, textContent, nodes, tick } from './mount.mjs'
import CatalogPage from '../src/pages/catalog/index.tsx'
import PreviewPage from '../src/packagePreview/pages/preview/index.tsx'
import AiRecommendPage from '../src/packagePreview/pages/ai/recommend.tsx'
import { PreviewFloor2d } from '../src/packagePreview/components/preview-2d/index.tsx'
import { useCatalogStore } from '../src/stores/catalogStore.ts'
import { usePlanStore } from '../src/stores/planStore.ts'
import Taro from '@tarojs/taro'

const room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }

test('catalog mounts, filters and clears without unstable snapshot updates', async () => {
  useCatalogStore.getState().clearFilters()
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args) => { errors.push(args) }
  let page: ReturnType<typeof mount> | undefined
  try {
    page = mount(CatalogPage)
    assert.equal(byClass(page.tree, 'product-card').length, 14)
    useCatalogStore.getState().setFilters({ category: 'sofa' })
    await tick(); page.flush()
    assert.equal(byClass(page.tree, 'product-card').length, 2)
    useCatalogStore.getState().clearFilters()
    await tick(); page.flush()
    assert.equal(byClass(page.tree, 'product-card').length, 14)
    assert.deepEqual(errors, [], 'mount/filter must not warn about unstable snapshots or update loops')
  } finally {
    page?.unmount()
    console.error = originalError
  }
})

test('2D uses measured width for rendering and touch movement; overflow can be placed', async () => {
  const products = useCatalogStore.getState().products.filter((p) => p.category === 'bed' || p.id === 'p-other-luxury-14')
  const page = mount(PreviewFloor2d, { room: { ...room, depthMm: 2100 }, products })
  await tick(); page.flush()
  assert.equal(byClass(page.tree, 'preview2d__room')[0].props.style.width, '320px')
  assert.match(textContent(page.tree), /待摆放：轻奢衣帽镜/)
  const pending = byClass(page.tree, 'preview2d__pending')[0]
  pending.children[1].props.onClick()
  await tick(); page.flush()
  assert.equal(byClass(page.tree, 'preview2d__pending').length, 0)
  const item = byClass(page.tree, 'preview2d__item')[0]
  item.props.onTouchStart({ touches: [{ pageX: 0, pageY: 0 }] })
  item.props.onTouchMove({ touches: [{ pageX: 8, pageY: 0 }] })
  await tick(); page.flush()
  assert.equal(byClass(page.tree, 'preview2d__item')[0].props.style.left, '16px')
  page.unmount()
})

test('AI rejection ends loading and retry recovers from malformed response items', async () => {
  usePlanStore.getState().createPlan({ title: 'test', roomType: 'living', areaM2: 20 })
  Taro.testPlanId = usePlanStore.getState().activePlanId
  process.env.TARO_APP_AI_RECOMMEND_URL = 'https://example.invalid'
  Taro.request = async () => { throw Error('offline') }
  const page = mount(AiRecommendPage)
  await tick(); page.flush()
  assert.doesNotMatch(textContent(page.tree), /正在匹配/)
  assert.match(textContent(page.tree), /推荐失败/)
  Taro.request = async () => ({ statusCode: 200, data: [null, { productId: 'p-sofa-modern-01', score: 1, reason: 'ok' }] })
  nodes(page.tree, (node) => node.props?.onClick && textContent(node) === '推荐失败，点击重试')[0].props.onClick()
  await tick(); page.flush()
  assert.equal(byClass(page.tree, 'product-card').length, 1)
  page.unmount()
  delete process.env.TARO_APP_AI_RECOMMEND_URL
})

test('3D missing ready event times out to usable 2D; scene error also falls back', async () => {
  Taro.testPlanId = usePlanStore.getState().activePlanId
  const original = globalThis.setTimeout
  globalThis.setTimeout = ((cb, ms, ...args) => original(cb, ms === 8000 ? 5 : ms, ...args)) as typeof setTimeout
  try {
    for (const fail of ['timeout', 'error']) {
      const page = mount(PreviewPage)
      byClass(page.tree, 'preview-switch__btn')[0].props.onClick()
      await tick(); page.flush()
      const scene = nodes(page.tree, (node) => node.type === 'xr-furniture')[0]
      assert.ok(scene)
      if (fail === 'error') scene.props.onError()
      else await new Promise((resolve) => original(resolve, 15))
      await tick(); page.flush()
      assert.equal(nodes(page.tree, (node) => node.type === 'xr-furniture').length, 0)
      assert.equal(byClass(page.tree, 'preview2d').length, 1)
      page.unmount()
    }
  } finally { globalThis.setTimeout = original }
})

test('scan offers manual entry while session start is pending and releases on cancel/unmount', async () => {
  const { default: ScanPage } = await import('../src/packageScan/pages/scan/index.tsx')
  let destroyed = 0
  let started = 0
  Taro.testPlanId = 'scan-plan'
  Taro.authorize = async () => ({})
  Taro.createVKSession = () => ({
    start: () => { started++ }, destroy: () => { destroyed++ }, hitTest: () => [],
  })
  const page = mount(ScanPage)
  await tick(); page.flush()
  assert.equal(started, 1)
  assert.match(textContent(page.tree), /正在检测测量能力/)
  nodes(page.tree, (node) => node.props?.onClick && textContent(node) === '改用手填')[0].props.onClick()
  await tick(); page.flush()
  assert.match(textContent(page.tree), /手动填写房型/)
  assert.equal(destroyed, 1)
  page.unmount()
  assert.equal(destroyed, 1)
  delete Taro.createVKSession
})

test('initial null and zero container queries recover without resize; retries are bounded', async () => {
  const original = Taro.createSelectorQuery
  let calls = 0
  Taro.createSelectorQuery = () => {
    const q = { select: () => q, boundingClientRect: () => q, exec: (cb) => cb([++calls === 1 ? null : { width: calls === 2 ? 0 : 300 }]) }
    return q
  }
  const page = mount(PreviewFloor2d, { room, products: [] })
  try {
    Taro.testReady?.()
    await new Promise((resolve) => setTimeout(resolve, 600)); page.flush()
    assert.equal(byClass(page.tree, 'preview2d__room')[0]?.props.style.width, '300px')
    assert.ok(calls <= 8)
  } finally { page.unmount(); Taro.createSelectorQuery = original }
})

test('scan hide and camera stop release sessions and return to manual entry', async () => {
  const { default: ScanPage } = await import('../src/packageScan/pages/scan/index.tsx')
  for (const event of ['hide', 'stop']) {
    let destroyed = 0
    Taro.testPlanId = 'scan-plan'
    Taro.authorize = async () => ({})
    Taro.createVKSession = () => ({ start: (cb) => cb(0), destroy: () => { destroyed++ }, hitTest: () => [] })
    const page = mount(ScanPage)
    try {
      await tick(); page.flush()
      if (event === 'hide') Taro.testHide?.()
      else nodes(page.tree, (node) => node.type === 'camera')[0].props.onStop?.()
      await tick(); page.flush()
      assert.equal(destroyed, 1)
      assert.match(textContent(page.tree), /手动填写房型/)
      Taro.testShow?.(); await tick(); page.flush()
      assert.match(textContent(page.tree), /手动填写房型/)
    } finally { page.unmount(); delete Taro.createVKSession }
    assert.equal(destroyed, 1)
  }
})

test('AI unknown IDs show empty state; malformed success can retry to legitimate empty array', async () => {
  Taro.testPlanId = usePlanStore.getState().activePlanId
  process.env.TARO_APP_AI_RECOMMEND_URL = 'https://example.invalid'
  for (const data of [[{ productId: 'unknown', score: 1, reason: 'x' }], { error: 'bad' }]) {
    Taro.request = async () => ({ statusCode: 200, data })
    const page = mount(AiRecommendPage)
    try {
      await tick(); page.flush()
      if (!Array.isArray(data)) {
        assert.match(textContent(page.tree), /推荐失败/)
        Taro.request = async () => ({ statusCode: 200, data: [] })
        nodes(page.tree, (node) => node.props?.onClick && textContent(node) === '推荐失败，点击重试')[0].props.onClick()
        await tick(); page.flush()
      }
      assert.equal(byClass(page.tree, 'ai-empty').length, 1)
    } finally { page.unmount() }
  }
  delete process.env.TARO_APP_AI_RECOMMEND_URL
})

test('zero-width retries stop, manual retry recovers, and unmount cancels queued queries', async () => {
  const original = Taro.createSelectorQuery
  let calls = 0
  let width = 0
  Taro.createSelectorQuery = () => {
    const q = { select: () => q, boundingClientRect: () => q, exec: (cb) => { calls++; cb([{ width }]) } }
    return q
  }
  let page = mount(PreviewFloor2d, { room, products: [] })
  try {
    await new Promise((resolve) => setTimeout(resolve, 700)); page.flush()
    assert.equal(calls, 6)
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.equal(calls, 6)
    width = 280
    nodes(page.tree, (node) => node.props?.onClick && textContent(node) === '画布尚未就绪，点击重试')[0].props.onClick()
    await tick(); page.flush()
    assert.equal(byClass(page.tree, 'preview2d__room')[0].props.style.width, '280px')
    page.unmount()
    width = 0
    page = mount(PreviewFloor2d, { room, products: [] })
    page.unmount()
    const before = calls
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.equal(calls, before)
  } finally { page.unmount(); Taro.createSelectorQuery = original }
})

test('hide cancels pending scan startup and ignores late success', async () => {
  const { default: ScanPage } = await import('../src/packageScan/pages/scan/index.tsx')
  let finish
  let destroyed = 0
  Taro.testPlanId = 'scan-plan'
  Taro.authorize = async () => ({})
  Taro.createVKSession = () => ({ start: (cb) => { finish = cb }, destroy: () => { destroyed++ }, hitTest: () => [] })
  const page = mount(ScanPage)
  try {
    await tick(); page.flush()
    Taro.testHide()
    finish(0)
    await tick(); page.flush()
    assert.equal(destroyed, 1)
    assert.match(textContent(page.tree), /手动填写房型/)
    assert.equal(nodes(page.tree, (node) => node.type === 'camera').length, 0)
  } finally { page.unmount(); delete Taro.createVKSession }
})
