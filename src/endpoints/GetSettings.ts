import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Settings } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetSettings extends OpenAPIRoute {
  schema = {
    tags: ["Settings"],
    summary: "Get settings",
    responses: {
      "200": {
        description: "Get settings (placeholder)",
        content: {
          "application/json": { schema: z.object({ settings: Settings }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({ settings: { companyName: { bg: "Примерна фирма", en: "Example Company" }, currency: "EUR" } }, 200);
  }
}
