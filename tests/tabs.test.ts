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

test('app config wires tabs and subpackages', () => {
  assert.equal(appConfig.tabBar.list[0].text, '选品')
  assert.equal(appConfig.tabBar.list[1].text, '方案')
  assert.equal(appConfig.tabBar.list[2].text, '预算')
  assert.equal(appConfig.tabBar.list[3].text, '我的')
  assert.deepEqual(
    appConfig.subPackages.map((item) => item.root),
    ['packageScan', 'packagePreview'],
  )
  assert.ok(appConfig.pages.includes('pages/catalog/detail'))
  assert.ok(appConfig.pages.includes('pages/plans/detail'))
  assert.deepEqual(appConfig.pages, [
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
    'pages/catalog/detail',
    'pages/plans/detail',
  ])
  assert.equal(appConfig.tabBar.list.length, 4)
  assert.ok(
    appConfig.tabBar.list.every((item) => item.pagePath !== 'pages/catalog/detail'),
  )
  assert.ok(
    appConfig.tabBar.list.every((item) => item.pagePath !== 'pages/plans/detail'),
  )
})
