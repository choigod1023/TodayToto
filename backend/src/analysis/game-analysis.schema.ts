import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class GameAnalysis {
  @Prop({ required: true })
  gameId: number;

  @Prop({ type: Object, required: true })
  markets: {
    fullTime1x2: boolean;
    overUnder: boolean;
    handicap: boolean;
  };

  @Prop({ type: Object, required: true })
  oddsSnapshot: any;

  @Prop({ required: true, index: true })
  oddsHash: string;

  @Prop({ type: Object, required: true })
  result: any;

  @Prop({ default: 1 })
  version: number;
}

export type GameAnalysisDocument = GameAnalysis & Document;

export const GameAnalysisSchema = SchemaFactory.createForClass(GameAnalysis);
