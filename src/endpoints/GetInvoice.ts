import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Invoice, IdParams } from "../types";
import { getInvoice } from "../db/storage";

export class GetInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"], summary: "Get an invoice",
    request: { params: IdParams },
    responses: {
      ...ErrorResponses,
      "200": { description: "Get an invoice", content: { "application/json": { schema: z.object({ invoice: Invoice }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: await getInvoice(c.env.invoicer, data.params.id) });
  }
}
