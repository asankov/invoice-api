import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { type AppContext, ErrorResponses, Dashboard } from '../types';
import { getDashboard } from '../db/storage';

export class GetDashboard extends OpenAPIRoute {
  schema = {
    tags: ['Dashboard'],
    summary: 'Get dashboard',
    responses: {
      ...ErrorResponses,
      '200': {
        description: 'Get dashboard',
        content: { 'application/json': { schema: z.object({ dashboard: Dashboard }) } },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({ dashboard: await getDashboard(c.env.invoicer) });
  }
}
