import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameAnalysis, GameAnalysisSchema } from './game-analysis.schema';
import { AnalysisService } from './analysis.service';
import { AnalysisSchedulerService } from './analysis-scheduler.service';
import { AnalysisController } from './analysis.controller';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameAnalysis.name, schema: GameAnalysisSchema },
    ]),
    forwardRef(() => GamesModule),
  ],
  providers: [AnalysisService, AnalysisSchedulerService],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
