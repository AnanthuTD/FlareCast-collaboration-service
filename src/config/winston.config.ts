import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';
import LokiTransport from 'winston-loki';

const basicAuthentication =
  process.env.LOKI_USER_ID + ':' + process.env.LOKI_API_KEY;

export const winstonLogger = WinstonModule.createLogger({
  transports: [
    // Console transport with JSON format
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.json(), // Output logs as JSON
      ),
    }),

    // Loki transport with JSON format
    new LokiTransport({
      host: process.env.GRAFANA_HOST,
      labels: { app: 'collaboration-service' },
      json: true,
      format: format.json(), // Ensure logs are sent as JSON to Loki
      basicAuth: basicAuthentication,
      replaceTimestamp: true,
      onConnectionError: (err) => console.error(err),
    }),
  ],
});
