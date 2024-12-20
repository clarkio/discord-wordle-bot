import { Elysia, t } from "elysia";
import { swagger } from '@elysiajs/swagger';

import { startBot } from '../bot';
import { stats } from './Stats';

const app = new Elysia()
  .use(swagger())
  .use(stats)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

startBot();
