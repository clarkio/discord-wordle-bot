import { Elysia, t } from "elysia";
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';

import { startBot } from '../bot';
import { stats } from './Stats';

const app = new Elysia()
  .use(swagger())
  .use(cors())
  .use(stats)
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

startBot();
