import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Invoice } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"],
    summary: "Get an invoice",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        description: "Get an invoice (placeholder)",
        content: {
          "application/json": { schema: z.object({ invoice: Invoice }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: { ...{ id: "invoice-1", customerId: "customer-1", total: 100, status: "draft" }, id: data.params.id } }, 200);
  }
}
