import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Customer, CustomerInput } from '../types';
import { createCustomer } from '../db/storage';

export class CreateCustomer extends OpenAPIRoute {
  schema = {
    tags: ['Customers'],
    summary: 'Create a customer',
    request: { body: { content: { 'application/json': { schema: CustomerInput } } } },
    responses: {
      ...ErrorResponses,
      '201': {
        description: 'Create a customer',
        content: { 'application/json': { schema: z.object({ customer: Customer }) } },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ customer: await createCustomer(c.env.invoicer, data.body) }, 201);
  }
}
