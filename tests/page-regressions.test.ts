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
