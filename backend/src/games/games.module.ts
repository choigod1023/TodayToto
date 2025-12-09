import { forwardRef, Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [forwardRef(() => AnalysisModule)],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule {}
