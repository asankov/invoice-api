import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Payment, IdParams } from "../types";
import { getPayments } from "../db/storage";

export class GetPayments extends OpenAPIRoute {
  schema = {
    tags: ["Payments"], summary: "List invoice payments",
    request: { params: IdParams },
    responses: {
      ...ErrorResponses,
      "200": { description: "List invoice payments", content: { "application/json": { schema: z.object({ payments: Payment.array() }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ payments: await getPayments(c.env.invoicer, data.params.id) });
  }
}
