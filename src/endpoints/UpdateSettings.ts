import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Settings } from "../types";

// Dummy endpoint: responses are not persisted.
export class UpdateSettings extends OpenAPIRoute {
  schema = {
    tags: ["Settings"],
    summary: "Update settings",
    request: {
      body: { content: { "application/json": { schema: Settings } } },
    },
    responses: {
      "200": {
        description: "Update settings (placeholder)",
        content: {
          "application/json": { schema: z.object({ settings: Settings }) },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ settings: data.body }, 200);
  }
}
