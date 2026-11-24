import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Payment, PaymentInput, IdParams } from '../types';
import { createPayment } from '../db/storage';

export class CreatePayment extends OpenAPIRoute {
  schema = {
    tags: ['Payments'],
    summary: 'Record an invoice payment',
    request: {
      params: IdParams,
      body: { content: { 'application/json': { schema: PaymentInput } } },
    },
    responses: {
      ...ErrorResponses,
      '201': {
        description: 'Record an invoice payment',
        content: { 'application/json': { schema: z.object({ payment: Payment }) } },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ payment: await createPayment(c.env.invoicer, data.params.id, data.body) }, 201);
  }
}
