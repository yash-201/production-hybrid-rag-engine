import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PdfModule } from './modules/pdf/pdf.module';
import { AiModule } from './modules/ai/ai.module';
import { VectorStoreModule } from './modules/vector-store/vector-store.module';
import { SearchModule } from './modules/search/search.module';
import { RagModule } from './modules/rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/(.*)'],
    }),
    PdfModule,
    AiModule,
    VectorStoreModule,
    SearchModule,
    RagModule,
  ],
})
export class AppModule {}
