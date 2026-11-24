import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ErrorResponses, Settings } from "../types";
import { updateSettings } from "../db/storage";

export class UpdateSettings extends OpenAPIRoute {
  schema = {
    tags: ["Settings"], summary: "Replace company settings",
    request: { body: { content: { "application/json": { schema: Settings } } } },
    responses: {
      ...ErrorResponses,
      "200": { description: "Replace company settings", content: { "application/json": { schema: z.object({ settings: Settings }) } } },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return c.json({ settings: await updateSettings(c.env.invoicer, data.body) });
  }
}
