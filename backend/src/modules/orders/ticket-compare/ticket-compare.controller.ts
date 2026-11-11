import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { TicketCompareService } from './ticket-compare.service.js';

type UploadedFileShape = { buffer: Buffer };
type UploadedFields = { fileA?: UploadedFileShape[]; fileB?: UploadedFileShape[] };

/**
 * Đối chiếu số điện thoại/số vé giữa 2 file Excel (vd. file nội bộ và file nhà xe tự xuất) để
 * tìm vé lệch: SĐT chỉ có ở 1 file, hoặc có ở cả 2 nhưng số vé khác nhau. Không lưu gì vào CSDL.
 */
@ApiTags('Ticket Compare')
@ApiBearerAuth()
@Controller('ticket-compare')
export class TicketCompareController {
  constructor(private readonly ticketCompareService: TicketCompareService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'fileA', maxCount: 1 },
        { name: 'fileB', maxCount: 1 },
      ],
      { limits: { fileSize: 20 * 1024 * 1024 } },
    ),
  )
  async compare(@UploadedFiles() files: UploadedFields) {
    const fileA = files.fileA?.[0];
    const fileB = files.fileB?.[0];
    if (!fileA || !fileB) {
      throw new BadRequestException('Vui lòng chọn đủ 2 file Excel để so sánh.');
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã so sánh 2 file',
      data: await this.ticketCompareService.compare(fileA.buffer, fileB.buffer),
    };
  }
}
