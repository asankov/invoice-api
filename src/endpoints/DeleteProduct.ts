import { OpenAPIRoute } from 'chanfana';
import { type AppContext, ErrorResponses, IdParams } from '../types';
import { deleteProduct } from '../db/products';

export class DeleteProduct extends OpenAPIRoute {
  schema = {
    tags: ['Products'],
    summary: 'Delete a catalog product',
    request: { params: IdParams },
    responses: {
      ...ErrorResponses,
      '204': { description: 'Product deleted; invoice snapshots are retained' },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    await deleteProduct(c.env.invoicer, data.params.id);
    return c.body(null, 204);
  }
}
