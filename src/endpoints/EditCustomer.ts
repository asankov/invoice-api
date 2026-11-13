import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Customer, Task } from "../types";

export class EditCustomer extends OpenAPIRoute {
	schema = {
	  tags: ["Customers"],
		summary: "Edit a Customer",
		request: {
      body: {
				content: {
					"application/json": {
            schema: z.object({
              name: z.string().optional(),
              address: z.string().optional(),
              number: z.string().optional(),
            }),
					},
        },
			},
      params: z.object({
        id: z.string(),
      }),
		},
		responses: {
			"201": {
				description: "Returns the edited customer",
				content: {
					"application/json": {
						schema: z.object({
							task: Customer,
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

    const id = data.params.id;
		const dataToPatch = data.body;

    if (!dataToPatch.name && !dataToPatch.number && !dataToPatch.address) {
      return c.json(
        { error: "Invalid customer data" },
        400
      );
    }

		return c.json(
			{
				success: true,
        customer: {}
			},
			201,
		);
	}
}
