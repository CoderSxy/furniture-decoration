const { register } = require('node:module')
const { pathToFileURL } = require('node:url')

globalThis.defineAppConfig = (config) => config
globalThis.definePageConfig = (config) => config

register('./ts-ext-loader.mjs', pathToFileURL(__filename))
