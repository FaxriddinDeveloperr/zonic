import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/validation-problem';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: '*' });
  app.useWebSocketAdapter(new IoAdapter(app));

  // Equivalent of ASP.NET ModelState validation → ProblemDetails response shape.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // Swagger (Swashbuckle equivalent) at /swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Zonic API')
    .setDescription(
      [
        'GPS "zone capture" game backend (NestJS + TypeORM port of the .NET 8 original).',
        '',
        'Realtime (Socket.IO) namespace `/hubs/location` — JWT via handshake `auth.access_token`.',
        'In: StartRun(runTypeId), StopRun(), SendLocation(lat,lng,accuracy,speed,timestamp,runTypeId).',
        'Out: Connected, RunStarted, RunStopped, ZoneUpdated.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  const port = config.get<number>('port') ?? 5065;
  await app.listen(port);
  console.log(`Zonic (NestJS) listening on http://localhost:${port}`);
  console.log(`Swagger UI:   http://localhost:${port}/swagger`);
  console.log(`WS gateway:   ws://localhost:${port}/hubs/location`);
}

void bootstrap();
