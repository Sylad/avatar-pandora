import { Module } from '@nestjs/common';
import { WikiImageController } from './wiki-image.controller';
import { WikiImageService } from './wiki-image.service';

@Module({
  controllers: [WikiImageController],
  providers: [WikiImageService],
})
export class WikiImageModule {}
