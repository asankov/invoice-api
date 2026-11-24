import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Invoice, ListQuery } from '../types';
import { listInvoices } from '../db/storage';

export class GetInvoices extends OpenAPIRoute {
  schema = {
    tags: ['Invoices'],
    summary: 'List invoices',
    request: { query: ListQuery },
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'List invoices',
        content: {
          'application/json': {
            schema: z.object({
              invoices: Invoice.array(),
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json(await listInvoices(c.env.invoicer, data.query.limit, data.query.offset));
  }
}
