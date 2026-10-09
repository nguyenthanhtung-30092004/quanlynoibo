import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeService } from './realtime.service.js';

describe('GET /realtime/stream', () => {
  let app: INestApplication;
  let service: RealtimeService;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [RealtimeService],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    service = moduleRef.get(RealtimeService);
    url = `${await app.getUrl()}/realtime/stream`.replace('[::1]', 'localhost');
  });
  afterAll(() => app.close());

  it('đẩy sự kiện change tới client đang nghe, với header chống gom đệm', async () => {
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-transform');

    service.emit({ topic: 'orders', actorId: 3 });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
      // Gói đầu có thể chỉ là dòng trống mở luồng: đọc tới khi thấy sự kiện
      while (!text.includes('"topic"')) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }
      expect(text).toContain('event: change');
      expect(text).toContain('"topic":"orders"');
    } finally {
      controller.abort();
    }
  });
});
