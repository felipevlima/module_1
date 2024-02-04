import { knex } from '../database'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto, { randomUUID } from 'node:crypto'
import { checkSessionIdExists } from '../middleware/check-session-id-exists'

export async function transactionsRoutes(app: FastifyInstance) {
  // Global middleware
  // app.addHook('preHandler', async (request, reply) => {
  //   console.log(`[${request.method}] ${request.url}`)
  // })

  app.get(
    '/',
    { preHandler: [checkSessionIdExists] },
    async (request, response) => {
      const { sessionId } = request.cookies

      const transaction = await knex('transactions')
        .where('session_id', sessionId)
        .select()

      return {
        total: transaction.length,
        transaction,
      }
    },
  )

  app.get('/:id', { preHandler: [checkSessionIdExists] }, async (request) => {
    const { sessionId } = request.cookies

    const getTransactionParamsSchema = z.object({
      id: z.string().uuid(),
    })

    const { id } = getTransactionParamsSchema.parse(request.params)

    const transaction = await knex('transactions')
      .where({
        id,
        session_id: sessionId,
      })
      .first()

    return { transaction }
  })

  app.get(
    '/summary',
    { preHandler: [checkSessionIdExists] },
    async (request, response) => {
      const { sessionId } = request.cookies
      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', { as: 'amount' })
        .first()

      return { summary }
    },
  )

  app.post('/', async (request, response) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    })

    const { title, amount, type } = createTransactionBodySchema.parse(
      request.body,
    )

    let sessionId = request.cookies.sessionId

    if (!sessionId) {
      sessionId = randomUUID()

      response.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    await knex('transactions').insert({
      id: crypto.randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    })

    return response.code(201).send()
  })
}
