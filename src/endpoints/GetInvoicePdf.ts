import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetInvoicePdf extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"],
    summary: "Get an invoice PDF placeholder",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        description: "Get an invoice PDF placeholder (placeholder)",
        content: {
          "application/json": { schema: z.object({ invoiceId: z.string(), pdf: z.null(), message: z.string() }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoiceId: data.params.id, pdf: null, message: "PDF generation is not implemented yet" }, 200);
  }
}
