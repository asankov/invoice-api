import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Product, ProductInput } from "../types";
import { createProduct } from "../db/products";

export class CreateProduct extends OpenAPIRoute {
  schema = {
    tags: ["Products"], summary: "Create a product",
    request: { body: { content: { "application/json": { schema: ProductInput } } } },
    responses: {
      ...ErrorResponses,
      "201": { description: "Create a product", content: { "application/json": { schema: z.object({ product: Product }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ product: await createProduct(c.env.invoicer, data.body) }, 201);
  }
}
