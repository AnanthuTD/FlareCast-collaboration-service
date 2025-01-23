import { createLogger, transports, format } from 'winston';
import LokiTransport from 'winston-loki';

const basicAuthentication =
  process.env.LOKI_USER_ID + ':' + process.env.LOKI_API_KEY;

const options = {
  level: 'debug',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new LokiTransport({
      host: process.env.GRAFANA_HOST,
      labels: { app: 'collaboration-service' },
      json: true,
      basicAuth: basicAuthentication,
      replaceTimestamp: true,
      onConnectionError: (err) => console.error(err),
    }),

    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
};

export const logger = createLogger(options);
