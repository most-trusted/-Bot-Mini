import Pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const logger = Pino({
  level,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export default logge
r;
