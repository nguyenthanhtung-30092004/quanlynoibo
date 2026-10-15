import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    let dbStatus = 'ok';
    let dbLatencyMs = 0;
    if (this.dataSource) {
      try {
        const start = Date.now();
        await this.dataSource.query('SELECT 1');
        dbLatencyMs = Date.now() - start;
      } catch {
        dbStatus = 'error';
      }
    } else {
      dbStatus = 'unconfigured';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    };
  }
}
