import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Invoice, InvoiceInput } from "../types";

// Dummy endpoint: responses are not persisted.
export class CreateInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"],
    summary: "Create an invoice",
    request: {
      body: { content: { "application/json": { schema: InvoiceInput } } },
    },
    responses: {
      "201": {
        description: "Create an invoice (placeholder)",
        content: {
          "application/json": { schema: z.object({ invoice: Invoice }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: { ...data.body, id: "invoice-1", status: "draft" } }, 201);
  }
}
