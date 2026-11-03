import assert from 'node:assert/strict'
import test from 'node:test'
import { TAB_ITEMS } from '../src/constants/tabs.ts'

;(globalThis as { defineAppConfig?: <T>(config: T) => T }).defineAppConfig = (config) => config

import appConfig from '../src/app.config.ts'

test('four tabs use spec titles and paths', () => {
  assert.deepEqual(
    TAB_ITEMS.map((item) => [item.pagePath, item.text]),
    [
      ['pages/catalog/index', '选品'],
      ['pages/plans/index', '方案'],
      ['pages/budget/index', '预算'],
      ['pages/mine/index', '我的'],
    ],
  )
})

test('app config wires tabs, subpackages, and camera privacy copy', () => {
  assert.equal(appConfig.tabBar.list[0].text, '选品')
  assert.equal(appConfig.tabBar.list[1].text, '方案')
  assert.equal(appConfig.tabBar.list[2].text, '预算')
  assert.equal(appConfig.tabBar.list[3].text, '我的')
  assert.deepEqual(
    appConfig.subPackages.map((item) => item.root),
    ['packageScan', 'packagePreview'],
  )
  assert.deepEqual(appConfig.pages, [
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
    'pages/catalog/detail',
    'pages/plans/detail',
  ])
  assert.equal(appConfig.tabBar.list.length, 4)
  assert.ok(appConfig.tabBar.list.every((item) => item.pagePath !== 'pages/plans/detail'))
  assert.ok(
    appConfig.subPackages.some(
      (item) => item.root === 'packageScan' && item.pages.includes('pages/scan/index'),
    ),
  )
  const preview = appConfig.subPackages.find((item) => item.root === 'packagePreview')
  assert.deepEqual(preview?.pages, ['pages/ai/recommend', 'pages/preview/index'])
  assert.ok(
    appConfig.tabBar.list.every(
      (item) =>
        item.pagePath !== 'packagePreview/pages/ai/recommend' &&
        item.pagePath !== 'packagePreview/pages/preview/index',
    ),
  )
  assert.equal(appConfig.permission?.['scope.camera']?.desc, '访问你的摄像头')
})
