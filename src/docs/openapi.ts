import { z, type ZodType } from 'zod';


interface EndpointDoc {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  body?: ZodType;
  secured?: boolean; 
  responses: Record<string, { description: string; example?: unknown }>;
}

const endpoints: EndpointDoc[] = [];

export function registerEndpoint(doc: EndpointDoc): void {
  endpoints.push(doc);
}
export function buildPaths(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const e of endpoints) {
    const entry = (paths[e.path] ??= {});
    entry[e.method] = {
      tags: [e.tag],
      summary: e.summary,
      ...(e.secured ? { security: [{ bearerAuth: [] }] } : {}),
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: z.toJSONSchema(e.body) },
              },
            },
          }
        : {}),
      responses: Object.fromEntries(
        Object.entries(e.responses).map(([status, r]) => [
          status,
          {
            description: r.description,
            ...(r.example
              ? { content: { 'application/json': { example: r.example } } }
              : {}),
          },
        ]),
      ),
    };
  }

  return paths;
}

  