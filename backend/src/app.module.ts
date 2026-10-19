import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import authConfig from './config/auth.config.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthGuard } from './modules/auth/guards/auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { CarriersModule } from './modules/carriers/carriers.module.js';
import { LeaveModule } from './modules/leave/leave.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PartnersModule } from './modules/partners/partners.module.js';
import { PayrollModule } from './modules/payroll/payroll.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RoutesModule } from './modules/routes/routes.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { InitialSchemaGuards1710000000001 } from './migrations/1710000000001-InitialSchemaGuards.js';
import { PerformanceIndexesAndNormalizedColumns1710000000002 } from './migrations/1710000000002-PerformanceIndexesAndNormalizedColumns.js';
import { LeaveRegistration1710000000003 } from './migrations/1710000000003-LeaveRegistration.js';
import { LeaveHistory1710000000004 } from './migrations/1710000000004-LeaveHistory.js';
import { RenameShortPartnerNames1710000000005 } from './migrations/1710000000005-RenameShortPartnerNames.js';
import { RenameAnhHuyMc1710000000006 } from './migrations/1710000000006-RenameAnhHuyMc.js';
import { RenameHkAndG81710000000007 } from './migrations/1710000000007-RenameHkAndG8.js';
import { RenameHkBus1710000000008 } from './migrations/1710000000008-RenameHkBus.js';
import { PartnerTrigramIndex1710000000009 } from './migrations/1710000000009-PartnerTrigramIndex.js';
import { PhoneTrigramDropSearchText1710000000010 } from './migrations/1710000000010-PhoneTrigramDropSearchText.js';
import { PartnerCommissionPercent1710000000011 } from './migrations/1710000000011-PartnerCommissionPercent.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: Number(config.get<string>('DATABASE_PORT', '5432')),
        username: config.get<string>('DATABASE_USERNAME', 'postgres'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME', 'quan_ly_noi_bo'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DATABASE_SYNCHRONIZE') === 'true',
        migrationsRun: true,
        migrations: [
          InitialSchemaGuards1710000000001,
          PerformanceIndexesAndNormalizedColumns1710000000002,
          LeaveRegistration1710000000003,
          LeaveHistory1710000000004,
          RenameShortPartnerNames1710000000005,
          RenameAnhHuyMc1710000000006,
          RenameHkAndG81710000000007,
          RenameHkBus1710000000008,
          PartnerTrigramIndex1710000000009,
          PhoneTrigramDropSearchText1710000000010,
          PartnerCommissionPercent1710000000011,
        ],
        extra: {
          max: Number(config.get<string>('DATABASE_POOL_MAX', '25')),
          idleTimeoutMillis: Number(config.get<string>('DATABASE_POOL_IDLE_TIMEOUT_MS', '30000')),
          connectionTimeoutMillis: Number(config.get<string>('DATABASE_POOL_CONN_TIMEOUT_MS', '5000')),
          statement_timeout: Number(config.get<string>('DATABASE_STATEMENT_TIMEOUT_MS', '10000')),
          application_name: 'quan_ly_noi_bo_backend',
        },
      }),
    }),
    UsersModule,
    AuthModule,
    OrdersModule,
    CarriersModule,
    PartnersModule,
    RoutesModule,
    SettingsModule,
    PayrollModule,
    AttendanceModule,
    LeaveModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Thứ tự quan trọng: xác thực (gán request.user) trước, rồi mới kiểm tra vai trò
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
