import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Invoice, InvoicePatch, IdParams } from '../types';
import { editInvoice } from '../db/storage';

export class EditInvoice extends OpenAPIRoute {
  schema = {
    tags: ['Invoices'],
    summary: 'Edit a draft invoice',
    request: {
      params: IdParams,
      body: { content: { 'application/json': { schema: InvoicePatch } } },
    },
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'Edit a draft invoice',
        content: { 'application/json': { schema: z.object({ invoice: Invoice }) } },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: await editInvoice(c.env.invoicer, data.params.id, data.body) });
  }
}
