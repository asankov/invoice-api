import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Customer, ListQuery } from "../types";
import { listCustomers } from "../db/storage";

export class GetCustomers extends OpenAPIRoute {
  schema = {
    tags: ["Customers"], summary: "List customers",
    request: { query: ListQuery },
    responses: {
      ...ErrorResponses,
      "200": { description: "List customers", content: { "application/json": { schema: z.object({ customers: Customer.array(), total: z.number(), limit: z.number(), offset: z.number() }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json(await listCustomers(c.env.invoicer, data.query.limit, data.query.offset));
  }
}
