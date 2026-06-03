/**
 * Script para crear el servicio Nervus Backend en Render.
 * Uso: node scripts/create-render-service.js RENDER_API_KEY DB_URL JWT_SECRET
 */
const https = require('https')

const [, , RENDER_API_KEY, DB_URL, JWT_SECRET] = process.argv

if (!RENDER_API_KEY || !DB_URL || !JWT_SECRET) {
  console.error('Uso: node scripts/create-render-service.js RENDER_API_KEY DB_URL JWT_SECRET')
  process.exit(1)
}

const body = JSON.stringify({
  type: 'web_service',
  name: 'nervus-backend',
  ownerId: null,
  repo: 'https://github.com/kacheablecr-jpg/nervus-backend',
  branch: 'master',
  autoDeploy: 'yes',
  region: 'oregon',
  plan: 'free',
  runtime: 'node',
  buildCommand: 'pnpm install && pnpm run build',
  startCommand: 'node dist/main',
  envVars: [
    { key: 'NODE_ENV',     value: 'production' },
    { key: 'PORT',         value: '4000' },
    { key: 'DATABASE_URL', value: DB_URL },
    { key: 'JWT_SECRET',   value: JWT_SECRET },
  ],
})

const options = {
  hostname: 'api.render.com',
  path: '/v1/services',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const json = JSON.parse(data)
      console.log('✅ Servicio creado:')
      console.log('  ID:', json.service?.id)
      console.log('  URL:', json.service?.serviceDetails?.url)
      console.log('  Dashboard: https://dashboard.render.com/web/' + json.service?.id)
    } else {
      console.error('❌ Error HTTP', res.statusCode)
      console.error(data)
    }
  })
})

req.on('error', e => console.error('Error de red:', e.message))
req.write(body)
req.end()
