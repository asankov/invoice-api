import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Settings } from '../types';
import { getSettings } from '../db/storage';

export class GetSettings extends OpenAPIRoute {
  schema = {
    tags: ['Settings'],
    summary: 'Get company settings',
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'Get company settings',
        content: { 'application/json': { schema: z.object({ settings: Settings }) } },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({ settings: await getSettings(c.env.invoicer) });
  }
}
