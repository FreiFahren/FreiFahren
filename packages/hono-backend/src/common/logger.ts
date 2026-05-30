import pino from 'pino'

export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: {
        targets: [
            {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    ignore: 'pid,hostname,req,res,responseTime,reqId',
                    // Render the request summary whenever request data is present. We gate on `req`
                    // (always set for request logs) instead of `responseTime`, because very fast
                    // requests can report `responseTime: 0`, which `{if responseTime}` treats as
                    // falsy and would otherwise produce blank `INFO:` lines.
                    messageFormat:
                        '{if req}{req.method} {req.url} {res.status} ({responseTime}ms){end}{if msg} {msg}{end}',
                    translateTime: 'SYS:standard',
                    destination: 1,
                },
            },
            {
                target: 'pino-roll',
                options: {
                    file: './app.log',
                    frequency: 'daily',
                    mkdir: true,
                },
            },
        ],
    },
})
