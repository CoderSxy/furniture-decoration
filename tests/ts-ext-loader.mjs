import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export async function resolve(specifier, context, nextResolve) {
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
      return nextResolve(specifier, context)
    }
  }
  return nextResolve(specifier, context)
}
