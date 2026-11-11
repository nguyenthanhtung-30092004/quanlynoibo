import { BadRequestException, Injectable } from '@nestjs/common';
import { parseTicketWorkbook } from './ticket-compare.parser.js';
import { compareTicketCounts, type TicketCompareResult } from './ticket-compare.util.js';

export interface TicketCompareResponse extends TicketCompareResult {
  cancelledCountA: number;
  cancelledCountB: number;
}

@Injectable()
export class TicketCompareService {
  async compare(bufferA: Buffer, bufferB: Buffer): Promise<TicketCompareResponse> {
    const [a, b] = await Promise.all([this.parse(bufferA), this.parse(bufferB)]);
    return {
      ...compareTicketCounts(a.rows, b.rows),
      cancelledCountA: a.cancelledCount,
      cancelledCountB: b.cancelledCount,
    };
  }

  private async parse(buffer: Buffer) {
    try {
      return await parseTicketWorkbook(buffer);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'File không hợp lệ.');
    }
  }
}
