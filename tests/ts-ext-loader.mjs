export async function resolve(specifier, context, nextResolve) {
  const hasExplicitExt = /\.[a-zA-Z0-9]+$/.test(specifier)
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !hasExplicitExt) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      return nextResolve(specifier, context)
    }
  }
  return nextResolve(specifier, context)
}
