import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Product, ListQuery } from "../types";
import { listProducts } from "../db/products";

export class GetProducts extends OpenAPIRoute {
  schema = {
    tags: ["Products"], summary: "List products",
    request: { query: ListQuery },
    responses: {
      ...ErrorResponses,
      "200": { description: "List products", content: { "application/json": { schema: z.object({ products: Product.array(), total: z.number(), limit: z.number(), offset: z.number() }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json(await listProducts(c.env.invoicer, data.query.limit, data.query.offset));
  }
}
