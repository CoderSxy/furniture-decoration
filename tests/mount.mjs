import { createRequire } from 'node:module'
import React from 'react'
const require = createRequire(import.meta.url)
const taroRequire = createRequire(require.resolve('@tarojs/react'))
const Reconciler = taroRequire('react-reconciler')
const append = (parent, child) => { parent.children.push(child) }
const remove = (parent, child) => { parent.children.splice(parent.children.indexOf(child), 1) }
const renderer = Reconciler({
  now: Date.now, supportsMutation: true, isPrimaryRenderer: true,
  getRootHostContext: () => ({}), getChildHostContext: () => ({}),
  prepareForCommit: () => null, resetAfterCommit() {},
  createInstance: (type, props) => ({ type, props, children: [] }),
  createTextInstance: (text) => ({ text, children: [] }),
  appendInitialChild: append, appendChild: append, appendChildToContainer: append,
  removeChild: remove, removeChildFromContainer: remove,
  insertBefore(parent, child, before) { parent.children.splice(parent.children.indexOf(before), 0, child) },
  finalizeInitialChildren: () => false, prepareUpdate: () => true,
  commitUpdate(node, payload, type, old, props) { node.props = props },
  commitTextUpdate(node, old, text) { node.text = text },
  shouldSetTextContent: () => false, getPublicInstance: (node) => node,
  clearContainer(node) { node.children = [] },
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  getCurrentEventPriority: () => 16, detachDeletedInstance() {},
})
export function mount(Component, props = {}) {
  const tree = { children: [] }
  const root = renderer.createContainer(tree, 0, null, false, null, '', (error) => { throw error }, null)
  const flush = () => { renderer.flushPassiveEffects() }
  const render = () => { renderer.flushSync(() => renderer.updateContainer(React.createElement(Component, props), root, null)); flush() }
  render()
  return { tree, flush, unmount() { renderer.flushSync(() => renderer.updateContainer(null, root, null)); flush() } }
}
export function nodes(tree, predicate) {
  return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap((child) => nodes(child, predicate))]
}
export const byClass = (tree, name) => nodes(tree, (node) => node.props?.className === name)
export const textContent = (tree) => (tree.text ?? '') + tree.children.map(textContent).join('')
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
