import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true });
  // Note: PORT=0 intentionally falls back to 3003 (we want a deterministic port,
  // not the OS-assigned ephemeral one — production deployment hardcodes 3003).
  const port = parseInt(process.env.PORT ?? '3003', 10) || 3003;
  await app.listen(port, '0.0.0.0');
  console.log(`Eywa backend listening on http://0.0.0.0:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
