import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  const baseServerUrl =
    process.env.SERVER_URL || `http://localhost:${port || 3001}`;

  const config = new DocumentBuilder()
    .setTitle('SportsToto API')
    .setDescription('인기 경기, 경기 상세, Gemini 분석 API 문서')
    .setVersion('1.0.0')
    .setContact(
      'SportsToto Backend',
      'https://github.com/',
      'dev@sportstoto.local',
    )
    .setLicense('UNLICENSED', '')
    .setExternalDoc('README', 'https://github.com/')
    .addServer(baseServerUrl, '현재 서버')
    .addServer('http://localhost:3001', '로컬 개발 서버')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'SportsToto API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      operationsSorter: 'method',
      tagsSorter: 'alpha',
      defaultModelsExpandDepth: 1,
    },
  });

  await app.listen(port);
  console.log(`[Backend] 서버가 포트 ${port}에서 실행 중입니다.`);
}
void bootstrap();
