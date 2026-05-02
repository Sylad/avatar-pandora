import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { WikiImageModule } from './wiki-image/wiki-image.module';

@Module({
  imports: [WikiImageModule],
  controllers: [HealthController],
})
export class AppModule {}
