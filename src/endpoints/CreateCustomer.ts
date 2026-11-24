import { OpenAPIRoute } from "chanfana";
import { AppContext, Customer } from "../types";
import { z } from "zod";

export class CreateCustomer extends OpenAPIRoute {
  schema = {
    tags: ["Customers"],
    summary: "Create a new Customer",
    request: {
      body: {
        content: {
          "application/json": {
            schema: Customer,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Returns the created customer",
        content: {
          "application/json": {
            schema: z.object({
              customer: Customer,
            })
          }
        },
      }
    }
  }

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    const customer = data.body;

    if (!customer) {
      return c.json(
        { error: "Invalid customer data" },
        400
      );
    }

    return c.json({ customer }, 201)
  }
}
