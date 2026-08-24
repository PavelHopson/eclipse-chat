import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const REQUIRED_ACK = 'ephemeral-local-postgres'
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SERVER_ROOT = join(REPO_ROOT, 'apps', 'server')
const TEMP_PREFIX = join(REPO_ROOT, '.tmp-office-restart-')
const PG_BIN = process.env.OFFICE_QA_PG_BIN || 'C:\\postgres\\bin'
const SENTINEL_CLIENT = resolve(REPO_ROOT, '..', 'eclipse-hopson-sentinel', 'office', 'eclipse-chat-office-ingest-client.mjs')
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

type CommandOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  input?: Buffer
  timeoutMs?: number
}

type ProxyRecord = {
  body: string
  bodyHash: string
  nonce: string
  timestamp: string
  signature: string
  upstreamStatus: number
  upstreamBody: string
}

type SentinelIngestClient = {
  publishBatch(events: unknown[]): Promise<Array<{ id: string; sequence: number }>>
  dispose(): void
}

function fail(message: string): never {
  throw new Error(message)
}

function command(file: string, args: string[], stage: string, options: CommandOptions = {}) {
  return new Promise<void>((resolveCommand, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let outputBytes = 0
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`${stage} timed out`))
    }, options.timeoutMs ?? 120_000)
    child.stdout.on('data', (chunk: Buffer) => { outputBytes += chunk.length })
    child.stderr.on('data', (chunk: Buffer) => { outputBytes += chunk.length })
    child.once('error', () => {
      clearTimeout(timeout)
      reject(new Error(`${stage} could not start`))
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      child.stdout.destroy()
      child.stderr.destroy()
      if (code !== 0 || outputBytes > 2 * 1024 * 1024) {
        reject(new Error(`${stage} failed`))
        return
      }
      resolveCommand()
    })
    if (options.input) child.stdin.end(options.input)
    else child.stdin.end()
  })
}

function reservePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not reserve a loopback port'))
        return
      }
      const port = address.port
      server.close((error) => error ? reject(error) : resolvePort(port))
    })
  })
}

async function createPostgresCluster() {
  await mkdir(REPO_ROOT, { recursive: true })
  const tempRoot = await mkdtemp(TEMP_PREFIX)
  const dataDir = join(tempRoot, 'data')
  const logPath = join(tempRoot, 'postgres.log')
  const port = await reservePort()
  const username = 'office_qa_admin'
  const password = randomBytes(36).toString('base64url')
  const database = `eclipse_chat_office_qa_${randomUUID().replaceAll('-', '')}`
  let running = false

  const pg = (name: string) => join(PG_BIN, `${name}.exe`)
  const clientEnv = { ...process.env, PGPASSWORD: password }
  const start = async () => {
    running = true
    await command(pg('pg_ctl'), [
      '-D', dataDir, '-l', logPath, '-w', '-t', '30', 'start',
      '-o', `-h 127.0.0.1 -p ${port}`,
    ], 'PostgreSQL start', { timeoutMs: 45_000 })
  }
  const stop = async () => {
    if (!running) return
    try {
      await command(pg('pg_ctl'), ['-D', dataDir, '-w', '-t', '30', 'stop', '-m', 'fast'], 'PostgreSQL stop', { timeoutMs: 45_000 })
    } finally {
      running = false
    }
  }

  try {
    const passwordFile = join(tempRoot, 'initdb-password.txt')
    const passwordBytes = Buffer.from(`${password}\n`, 'utf8')
    await writeFile(passwordFile, passwordBytes, { mode: 0o600, flag: 'wx' })
    try {
      await command(pg('initdb'), [
        '-D', dataDir,
        '--username', username,
        '--encoding', 'UTF8',
        '--no-locale',
        '--auth-local', 'trust',
        '--auth-host', 'scram-sha-256',
        '--pwfile', passwordFile,
      ], 'PostgreSQL initdb', { timeoutMs: 180_000 })
    } finally {
      await writeFile(passwordFile, Buffer.alloc(passwordBytes.length), { flag: 'r+' }).catch(() => {})
      passwordBytes.fill(0)
      await rm(passwordFile, { force: true })
    }
    await start()
    await command(pg('createdb'), [
      '--host', '127.0.0.1', '--port', String(port), '--username', username, database,
    ], 'PostgreSQL database creation', { env: clientEnv, timeoutMs: 30_000 })
  } catch (error) {
    await stop().catch(() => {})
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }).catch(() => {})
    throw error
  }

  const databaseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`
  return {
    databaseUrl,
    async restart() {
      await stop()
      await start()
    },
    async cleanup() {
      await stop().catch(() => {})
      const resolved = resolve(tempRoot)
      if (!resolved.startsWith(resolve(TEMP_PREFIX))) fail('Refusing to remove an unexpected QA path')
      await rm(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
    },
  }
}

function forwardRequest(port: number, path: string, headers: IncomingHttpHeaders, body: string) {
  return new Promise<{ status: number; body: string; contentType: string }>((resolveForward, reject) => {
    const upstream = httpRequest({
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'x-office-key-id': headers['x-office-key-id'] as string,
        'x-office-timestamp': headers['x-office-timestamp'] as string,
        'x-office-nonce': headers['x-office-nonce'] as string,
        'x-office-signature': headers['x-office-signature'] as string,
      },
    }, (response) => {
      const chunks: Buffer[] = []
      let bytes = 0
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes <= 128 * 1024) chunks.push(chunk)
      })
      response.once('end', () => {
        if (bytes > 128 * 1024) {
          reject(new Error('Office Core QA response exceeded its bound'))
          return
        }
        resolveForward({
          status: response.statusCode || 500,
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: String(response.headers['content-type'] || 'application/json'),
        })
      })
    })
    upstream.once('error', reject)
    upstream.end(body)
  })
}

async function main() {
  if (process.env.OFFICE_RESTART_E2E_ACK !== REQUIRED_ACK) {
    fail(`Refusing to run: set OFFICE_RESTART_E2E_ACK=${REQUIRED_ACK} for the isolated local cluster`)
  }
  if (process.env.NODE_ENV === 'production') fail('Refusing to run Office restart QA in production mode')

  const cluster = await createPostgresCluster()
  let app: Awaited<ReturnType<typeof import('fastify')['default']>> | null = null
  let proxy: ReturnType<typeof createServer> | null = null
  let dbBase: (Awaited<typeof import('../db.js')>)['dbBase'] | null = null
  let ingestClient: SentinelIngestClient | null = null
  let conflictClient: SentinelIngestClient | null = null
  let qaSecret: Buffer | null = null

  try {
    process.env.DATABASE_URL = cluster.databaseUrl
    process.env.DIRECT_URL = cluster.databaseUrl
    process.env.NODE_ENV = 'test'
    await command(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], 'Prisma migration deploy', {
      cwd: SERVER_ROOT,
      env: { ...process.env, DATABASE_URL: cluster.databaseUrl, DIRECT_URL: cluster.databaseUrl },
      timeoutMs: 180_000,
    })

    const [{ default: Fastify }, { registerOfficeRoutes }, auth, database] = await Promise.all([
      import('fastify'),
      import('../routes/office.js'),
      import('../office/ingestAuth.js'),
      import('../db.js'),
    ])
    dbBase = database.dbBase
    await dbBase.$connect()

    const ownerId = `qa-owner-${randomUUID()}`
    const workspaceId = `qa-workspace-${randomUUID()}`
    await dbBase.user.create({
      data: { id: ownerId, email: `${ownerId}@invalid.test`, passwordHash: 'qa-not-a-login', displayName: 'Office QA' },
    })
    await dbBase.server.create({ data: { id: workspaceId, name: 'Office restart QA', ownerId } })

    const keyId = `qa-key-${randomUUID()}`
    const producerId = 'eclipse-hopson-sentinel-qa'
    qaSecret = randomBytes(32)
    const secret = qaSecret
    const registry = auth.loadOfficeIngestRegistry(JSON.stringify({
      [keyId]: { producerId, secret: secret.toString('base64url'), workspaceIds: [workspaceId] },
    }))

    app = Fastify({ logger: false })
    let coreErrorCode = 'none'
    app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const candidate = (error as { code?: unknown }).code
      coreErrorCode = typeof candidate === 'string' && /^[A-Z0-9_]{1,32}$/i.test(candidate)
        ? candidate
        : 'UNCLASSIFIED'
      return reply.status(500).send({ error: 'Office QA request failed' })
    })
    registerOfficeRoutes(app, { registry })
    const coreAddress = await app.listen({ host: '127.0.0.1', port: 0 })
    const corePort = Number(new URL(coreAddress).port)

    const records: ProxyRecord[] = []
    let loseFirstSuccess = true
    let restartError: Error | null = null
    proxy = createServer((request, response) => {
      void (async () => {
        const chunks: Buffer[] = []
        let bytes = 0
        for await (const chunk of request) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          bytes += buffer.length
          if (bytes > 64 * 1024) throw new Error('Office QA request exceeded 64 KiB')
          chunks.push(buffer)
        }
        const body = Buffer.concat(chunks).toString('utf8')
        const upstream = await forwardRequest(corePort, request.url || '/', request.headers, body)
        records.push({
          body,
          bodyHash: createHash('sha256').update(body).digest('hex'),
          nonce: String(request.headers['x-office-nonce'] || ''),
          timestamp: String(request.headers['x-office-timestamp'] || ''),
          signature: String(request.headers['x-office-signature'] || ''),
          upstreamStatus: upstream.status,
          upstreamBody: upstream.body,
        })
        if (loseFirstSuccess && upstream.status >= 200 && upstream.status < 300) {
          loseFirstSuccess = false
          await dbBase!.$disconnect()
          try {
            await cluster.restart()
            await dbBase!.$connect()
          } catch (error) {
            restartError = error instanceof Error ? error : new Error('PostgreSQL restart failed')
          }
          response.destroy()
          return
        }
        response.statusCode = upstream.status
        response.setHeader('content-type', upstream.contentType)
        response.end(upstream.body)
      })().catch((error) => {
        restartError = error instanceof Error ? error : new Error('Office QA proxy failed')
        if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' })
        response.end('{"error":"qa_proxy_failed"}')
      })
    })
    await new Promise<void>((resolveListen, reject) => {
      proxy!.once('error', reject)
      proxy!.listen(0, '127.0.0.1', resolveListen)
    })
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === 'string') fail('Office QA proxy did not bind to loopback')
    const baseUrl = `http://127.0.0.1:${proxyAddress.port}`

    const sentinel = await import(pathToFileURL(SENTINEL_CLIENT).href)
    const nonce = randomUUID()
    const common = {
      baseUrl,
      allowedOrigins: [baseUrl],
      allowHttpLoopback: true,
      workspaceId,
      keyId,
      secret,
      timeoutMs: 15_000,
      maxAttempts: 2,
      idempotentReplay: true,
      nonceFactory: () => nonce,
      sleep: async () => {},
    }
    const event = {
      workspaceId,
      type: 'agent.state.changed',
      subject: { kind: 'agent', id: 'sentinel' },
      summary: 'Sentinel restart replay QA',
      metadata: { producer: producerId, state: 'idle', readOnly: true },
    }
    ingestClient = sentinel.createEclipseChatOfficeIngestClient(common) as SentinelIngestClient
    let persisted: Array<{ id: string; sequence: number }>
    try {
      persisted = await ingestClient.publishBatch([event])
    } catch {
      if (restartError) throw restartError
      const statuses = records.map((record) => record.upstreamStatus).join(',') || 'none'
      throw new Error(`Office replay failed; upstream statuses=${statuses}; core error=${coreErrorCode}`)
    }
    if (restartError) throw restartError
    if (records.length !== 2) fail(`Expected exactly two replay requests, received ${records.length}`)
    if (records[0].upstreamStatus !== 200 || records[1].upstreamStatus !== 200) fail('Lost-2xx replay did not return two definite upstream 2xx responses')
    for (const field of ['body', 'bodyHash', 'nonce', 'timestamp', 'signature'] as const) {
      if (records[0][field] !== records[1][field]) fail(`Replay changed signed field: ${field}`)
    }
    if (records[0].upstreamBody !== records[1].upstreamBody) fail('Replay did not return the original persisted response')
    if (persisted.length !== 1 || persisted[0].sequence !== 1) fail('Sentinel did not receive the original Office event')
    if (await dbBase.officeEvent.count({ where: { serverId: workspaceId } }) !== 1) fail('Replay inserted a duplicate Office event')
    if (await dbBase.officeIngestNonce.count({ where: { producerId, nonce } }) !== 1) fail('Replay inserted a duplicate nonce ledger row')

    conflictClient = sentinel.createEclipseChatOfficeIngestClient({ ...common, maxAttempts: 1 }) as SentinelIngestClient
    let conflictCode = ''
    try {
      await conflictClient.publishBatch([{
        ...event,
        summary: 'Sentinel changed-body replay must fail',
      }])
    } catch (error) {
      conflictCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    }
    if (conflictCode !== 'HTTP_4XX') fail('Changed-body nonce replay was not rejected by the Sentinel transport')
    if (records.at(-1)?.upstreamStatus !== 409) fail('Changed-body nonce replay did not reach Office Core replay_conflict')
    if (await dbBase.officeEvent.count({ where: { serverId: workspaceId } }) !== 1) fail('Conflict path changed the Office journal')

    process.stdout.write(JSON.stringify({
      ok: true,
      postgresRestarts: 1,
      signedAttempts: 2,
      replayStatus: records[1].upstreamStatus,
      conflictStatus: records.at(-1)?.upstreamStatus,
      officeEvents: 1,
      nonceRows: 1,
    }) + '\n')
  } finally {
    ingestClient?.dispose()
    conflictClient?.dispose()
    qaSecret?.fill(0)
    if (proxy) await new Promise<void>((resolveClose) => proxy!.close(() => resolveClose()))
    if (app) await app.close().catch(() => {})
    if (dbBase) await dbBase.$disconnect().catch(() => {})
    await cluster.cleanup()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Office restart/replay QA failed'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
