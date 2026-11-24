import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Product, IdParams } from '../types';
import { getProduct } from '../db/products';

export class GetProduct extends OpenAPIRoute {
  schema = {
    tags: ['Products'],
    summary: 'Get a product',
    request: { params: IdParams },
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'Get a product',
        content: { 'application/json': { schema: z.object({ product: Product }) } },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ product: await getProduct(c.env.invoicer, data.params.id) });
  }
}
