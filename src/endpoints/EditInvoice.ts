import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Invoice, InvoiceInput } from "../types";

// Dummy endpoint: responses are not persisted.
export class EditInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"],
    summary: "Edit an invoice",
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: InvoiceInput.partial() } } },
    },
    responses: {
      "200": {
        description: "Edit an invoice (placeholder)",
        content: {
          "application/json": { schema: z.object({ invoice: Invoice }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: { ...{ id: "invoice-1", customerId: "customer-1", total: 100, items: [{ description: { bg: "Консултация", en: "Consulting" }, quantity: 1, unitPrice: 100 }], status: "draft" }, ...data.body, id: data.params.id } }, 200);
  }
}
