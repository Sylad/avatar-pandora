import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadAppEnv } from './env.schema';

async function bootstrap() {
  const env = loadAppEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.corsOrigin });
  await app.listen(env.port, '0.0.0.0');
  console.log(`Eywa backend listening on http://0.0.0.0:${env.port}/api`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
