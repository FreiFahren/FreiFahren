import { Scalar } from '@scalar/hono-api-reference'
import { Env, Hono } from 'hono'
import { z } from 'zod'

import { RouteDocs } from './router'

type RegisteredRoute = {
    method: 'get' | 'post' | 'put'
    path: string
    docs: RouteDocs
}

type OpenApiResponse = {
    description: string
    content?: {
        'application/json': {
            schema: Record<string, unknown>
        }
    }
}

type OpenApiOperation = {
    tags?: string[]
    summary: string
    description?: string
    responses: {
        200: OpenApiResponse
    }
    parameters?: {
        name: string
        in: 'query'
        required: boolean
        schema: Record<string, unknown>
    }[]
    requestBody?: {
        required: boolean
        content: {
            'application/json': {
                schema: Record<string, unknown>
            }
        }
    }
}

const withLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const zodToOpenApiSchema = (schema: z.ZodTypeAny): Record<string, unknown> => {
    const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) }
    delete jsonSchema.$schema
    return jsonSchema
}

export const createOpenApiDocument = (routes: RegisteredRoute[]) => {
    const paths: Partial<Record<string, Partial<Record<RegisteredRoute['method'], OpenApiOperation>>>> = {}

    routes.forEach((route) => {
        const openApiPath = withLeadingSlash(route.path)

        paths[openApiPath] ??= {}

        const response200: OpenApiResponse = { description: 'Successful response' }

        if (route.docs.responseSchema !== undefined) {
            response200.content = {
                'application/json': {
                    schema: zodToOpenApiSchema(route.docs.responseSchema),
                },
            }
        }

        const operation: OpenApiOperation = {
            tags: route.docs.tags,
            summary: route.docs.summary,
            description: route.docs.description,
            responses: { 200: response200 },
        }

        if (route.docs.requestSchema !== undefined) {
            operation.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: zodToOpenApiSchema(route.docs.requestSchema),
                    },
                },
            }
        }

        if (route.docs.querySchema !== undefined) {
            const { properties, required } = z.toJSONSchema(route.docs.querySchema) as {
                properties?: Record<string, Record<string, unknown>>
                required?: string[]
            }

            if (properties) {
                const requiredSet = new Set(required ?? [])
                operation.parameters = Object.entries(properties).map(([name, schema]) => ({
                    name,
                    in: 'query' as const,
                    required: requiredSet.has(name),
                    schema,
                }))
            }
        }

        paths[openApiPath][route.method] = operation
    })

    return {
        openapi: '3.1.0',
        info: {
            title: 'FreiFahren Rewrite API',
            version: '0.1.0',
            description: 'Auto-generated API documentation for the Hono rewrite backend.',
        },
        paths,
    }
}

export const registerDocsRoutes = <E extends Env>(app: Hono<E>, routes: RegisteredRoute[]) => {
    const openApiDocument = createOpenApiDocument(routes)

    app.get('/openapi.json', (c) => c.json(openApiDocument))
    app.get('/docs', Scalar({ url: '/openapi.json' }))
}
