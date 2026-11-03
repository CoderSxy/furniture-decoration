import assert from 'node:assert/strict'
import test from 'node:test'
import { useUiStore } from '../src/stores/uiStore.ts'

test('setFilterPanelOpen toggles the M0 filterPanelOpen flag', () => {
  useUiStore.setState({ filterPanelOpen: false })
  useUiStore.getState().setFilterPanelOpen(true)
  assert.equal(useUiStore.getState().filterPanelOpen, true)
  useUiStore.getState().setFilterPanelOpen(false)
  assert.equal(useUiStore.getState().filterPanelOpen, false)
})
