import { Module } from '@nestjs/common';
import { TicketCompareController } from './ticket-compare.controller.js';
import { TicketCompareService } from './ticket-compare.service.js';

@Module({
  controllers: [TicketCompareController],
  providers: [TicketCompareService],
})
export class TicketCompareModule {}
