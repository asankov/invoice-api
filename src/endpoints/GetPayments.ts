import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Payment } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetPayments extends OpenAPIRoute {
  schema = {
    tags: ["Payments"],
    summary: "Get invoice payments",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        description: "Get invoice payments (placeholder)",
        content: {
          "application/json": { schema: z.object({ payments: Payment.array() }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ payments: [{ id: "payment-1", invoiceId: data.params.id, amount: 25 }] }, 200);
  }
}
