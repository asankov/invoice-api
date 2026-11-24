import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Product, ProductPatch, IdParams } from "../types";
import { editProduct } from "../db/products";

export class EditProduct extends OpenAPIRoute {
  schema = {
    tags: ["Products"], summary: "Edit a product",
    request: { params: IdParams, body: { content: { "application/json": { schema: ProductPatch } } } },
    responses: {
      ...ErrorResponses,
      "200": { description: "Edit a product", content: { "application/json": { schema: z.object({ product: Product }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ product: await editProduct(c.env.invoicer, data.params.id, data.body) });
  }
}
