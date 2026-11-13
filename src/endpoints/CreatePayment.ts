import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Payment, PaymentInput } from "../types";

// Dummy endpoint: responses are not persisted.
export class CreatePayment extends OpenAPIRoute {
  schema = {
    tags: ["Payments"],
    summary: "Create an invoice payment",
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: PaymentInput } } },
    },
    responses: {
      "201": {
        description: "Create an invoice payment (placeholder)",
        content: {
          "application/json": { schema: z.object({ payment: Payment }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ payment: { ...data.body, id: "payment-1", invoiceId: data.params.id } }, 201);
  }
}
