import { Elysia, t } from "elysia";
import { swagger } from '@elysiajs/swagger';

import { wordleResult } from './WordleResult';

const app = new Elysia()
  .use(swagger())
  .use(wordleResult)
  .get("/hi", () => "Hello Elysia").listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
