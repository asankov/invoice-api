import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Customer, CustomerPatch, IdParams } from '../types';
import { editCustomer } from '../db/storage';

export class EditCustomer extends OpenAPIRoute {
  schema = {
    tags: ['Customers'],
    summary: 'Edit a customer',
    request: {
      params: IdParams,
      body: { content: { 'application/json': { schema: CustomerPatch } } },
    },
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'Edit a customer',
        content: { 'application/json': { schema: z.object({ customer: Customer }) } },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ customer: await editCustomer(c.env.invoicer, data.params.id, data.body) });
  }
}
