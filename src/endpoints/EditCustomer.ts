import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, CustomerPatch } from "../types";

export class EditCustomer extends OpenAPIRoute {
	schema = {
	  tags: ["Customers"],
		summary: "Edit a Customer",
		request: {
      body: {
				content: {
					"application/json": {
            schema: CustomerPatch,
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
							customer: CustomerPatch,
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const dataToPatch = data.body;

		return c.json(
			{
				success: true,
        customer: dataToPatch
			},
			201,
		);
	}
}
