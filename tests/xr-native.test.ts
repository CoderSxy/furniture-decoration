import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('native XR scene declares its renderer and forwards ready/error events to page', () => {
  const base = new URL('../src/packagePreview/native/xr-furniture/', import.meta.url)
  const config = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))
  assert.equal(config.renderer, 'xr-frame')
  const markup = readFileSync(new URL('index.wxml', base), 'utf8')
  assert.match(markup, /camera-orbit-control(?:\s|=)/)
  let component: any
  runInNewContext(readFileSync(new URL('index.js', base), 'utf8'), { Component: (value: any) => { component = value } })
  const events: string[] = []
  const host = { triggerEvent: (event: string) => events.push(event) }
  for (const event of ['ready', 'error']) {
    const handler = markup.match(new RegExp(`bind:${event}="([^"]+)"`))?.[1]
    assert.ok(handler)
    component.methods[handler].call(host)
  }
  assert.deepEqual(events, ['ready', 'error'])
})
