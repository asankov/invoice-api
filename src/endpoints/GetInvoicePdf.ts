import { OpenAPIRoute } from 'chanfana';
import { type AppContext, ErrorResponse, IdParams } from '../types';

export class GetInvoicePdf extends OpenAPIRoute {
  schema = {
    tags: ['Invoices'],
    summary: 'Invoice PDF (not implemented)',
    request: { params: IdParams },
    responses: {
      '501': {
        description: 'PDF rendering is deferred',
        content: { 'application/json': { schema: ErrorResponse } },
      },
    },
  };

  async handle(c: AppContext) {
    await this.getValidatedData<typeof this.schema>();
    return c.json({ error: 'PDF rendering is not implemented' }, 501);
  }
}
