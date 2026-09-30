import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./env.js";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { cors: { origin: env.WEB_ORIGIN, credentials: true } });
  app.enableShutdownHooks();

  const doc = new DocumentBuilder().setTitle("Genie Magnet OS API").setVersion("0.1.0").build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, doc));

  await app.listen(env.API_PORT);
  console.log(`API on http://localhost:${env.API_PORT} · docs at /docs`);
}

void bootstrap();
