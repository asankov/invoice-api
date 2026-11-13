import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Dashboard } from "../types";

// Dummy endpoint: responses are not persisted.
export class GetDashboard extends OpenAPIRoute {
  schema = {
    tags: ["Dashboard"],
    summary: "Get dashboard",
    responses: {
      "200": {
        description: "Get dashboard (placeholder)",
        content: {
          "application/json": { schema: z.object({ dashboard: Dashboard }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({ dashboard: { customerCount: 2, invoiceCount: 1, outstandingTotal: 100 } }, 200);
  }
}
