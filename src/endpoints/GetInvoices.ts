import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Invoice } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetInvoices extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"],
    summary: "Get invoices",
    responses: {
      "200": {
        description: "Get invoices (placeholder)",
        content: {
          "application/json": { schema: z.object({ invoices: Invoice.array() }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({ invoices: [{ id: "invoice-1", customerId: "customer-1", total: 100, items: [{ description: { bg: "Консултация", en: "Consulting" }, quantity: 1, unitPrice: 100 }], status: "draft" }] }, 200);
  }
}
