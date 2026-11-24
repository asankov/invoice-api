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
						name: { bg: "Алис Джонсън", en: "Alice Johnson" },
						address: { bg: "ул. Главна 123", en: "123 Main Street" },
						number: "+1-202-555-0101",
					},
					{
						name: { bg: "Боб Смит", en: "Bob Smith" },
						address: { bg: "бул. Дъб 456", en: "456 Oak Avenue" },
					},
				],
			},
			200,
		);
	}
}
