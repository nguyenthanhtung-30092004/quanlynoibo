import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MessageChannel } from '../messaging/message.types.js';

export class SendMessageDto {
  @ApiPropertyOptional({
    enum: MessageChannel,
    default: MessageChannel.SMS,
    description: 'Kênh gửi: SMS hoặc ZALO',
  })
  @IsOptional()
  @IsEnum(MessageChannel, { message: 'Kênh gửi phải là SMS hoặc ZALO' })
  channel?: MessageChannel;
}
