import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Customer } from "../types";

export class GetCustomers extends OpenAPIRoute {
	schema = {
		tags: ["Customers"],
		summary: "Get Customers",
		responses: {
			"200": {
				description: "Returns a list of customers",
				content: {
					"application/json": {
						schema: z.object({
							customers: Customer.array(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		return c.json(
			{
				customers: [
					{
						name: "Alice Johnson",
						address: "123 Main Street",
						number: "+1-202-555-0101",
					},
					{
						name: "Bob Smith",
						address: "456 Oak Avenue",
					},
				],
			},
			200,
		);
	}
}
