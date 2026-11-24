import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Invoice, InvoiceInput } from "../types";
import { createInvoice } from "../db/storage";

export class CreateInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"], summary: "Create a draft invoice",
    request: { body: { content: { "application/json": { schema: InvoiceInput } } } },
    responses: {
      ...ErrorResponses,
      "201": { description: "Create a draft invoice", content: { "application/json": { schema: z.object({ invoice: Invoice }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: await createInvoice(c.env.invoicer, data.body) }, 201);
  }
}
