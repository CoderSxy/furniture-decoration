export async function resolve(specifier, context, nextResolve) {
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
