import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { configureApp } from "./bootstrap.js";
import { loadEnv } from "./env.js";

async function bootstrap() {
  const env = loadEnv();
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false }));

  const doc = new DocumentBuilder().setTitle("Genie Magnet OS API").setVersion("0.1.0").addCookieAuth("better-auth.session_token").build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, doc));

  await app.listen(env.API_PORT);
  console.log(`API on http://localhost:${env.API_PORT} · docs at /docs · sign-in at /api/auth (${env.AUTH_MODE})`);
}

void bootstrap();
