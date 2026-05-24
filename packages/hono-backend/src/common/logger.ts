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
                    messageFormat: '{if responseTime}{req.method} {req.url} {res.status} ({responseTime}ms){end}{msg}',
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
