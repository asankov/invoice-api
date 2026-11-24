import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Invoice, IdParams } from "../types";
import { issueInvoice } from "../db/storage";

export class IssueInvoice extends OpenAPIRoute {
  schema = {
    tags: ["Invoices"], summary: "Issue an invoice",
    request: { params: IdParams },
    responses: {
      ...ErrorResponses,
      "200": { description: "Issue an invoice", content: { "application/json": { schema: z.object({ invoice: Invoice }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ invoice: await issueInvoice(c.env.invoicer, data.params.id) });
  }
}
