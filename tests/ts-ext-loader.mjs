import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@tarojs/components') {
    return { shortCircuit: true, url: pathToFileURL(join(here, 'components-stub.mjs')).href }
  }
  if (specifier === '@tarojs/taro') {
    return {
      shortCircuit: true,
      url: pathToFileURL(join(here, 'taro-stub.mjs')).href,
    }
  }
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  const hasExplicitExt = /\.[a-zA-Z0-9]+$/.test(specifier)
  if (isRelative && !hasExplicitExt) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      try { return await nextResolve(`${specifier}.tsx`, context) } catch {}
      try { return await nextResolve(`${specifier}/index.tsx`, context) } catch {}
      return nextResolve(specifier, context)
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.scss')) return { shortCircuit: true, format: 'module', source: 'export default {}' }
  if (url.endsWith('.tsx')) {
    const { readFile } = await import('node:fs/promises')
    const ts = await import('typescript')
    const source = ts.default.transpileModule(await readFile(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.default.JsxEmit.ReactJSX, module: ts.default.ModuleKind.ESNext, target: ts.default.ScriptTarget.ES2022 },
    }).outputText
    return { shortCircuit: true, format: 'module', source }
  }
  return nextLoad(url, context)
}
