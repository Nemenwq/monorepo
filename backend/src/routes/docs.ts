import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { parse } from 'yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const specPath = join(__dirname, '../../docs/openapi.yml')

let spec: Record<string, unknown>
try {
  spec = parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>
} catch (err) {
  console.error('[docs] Failed to load OpenAPI spec:', err)
  spec = { openapi: '3.0.3', info: { title: 'ShelterFlex API', version: '0.1.0' }, paths: {} }
}

const uiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'ShelterFlex API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
}

export function createDocsRouter(): Router {
  const router = Router()
  router.use('/', swaggerUi.serve)
  router.get('/', swaggerUi.setup(spec, uiOptions))
  return router
}
