import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { buildCompareWorkbook, displayName } from './ticket-compare.export.js';
import { TicketCompareService } from './ticket-compare.service.js';

type UploadedFileShape = { buffer: Buffer; originalname?: string };

/** Multer đọc tên file theo latin1 nên tên tiếng Việt bị lỗi font: đọc lại theo UTF-8 */
const fileName = (f: UploadedFileShape) =>
  f.originalname ? Buffer.from(f.originalname, 'latin1').toString('utf8') : undefined;

const UPLOAD = FileFieldsInterceptor(
  [
    { name: 'fileA', maxCount: 1 },
    { name: 'fileB', maxCount: 1 },
  ],
  { limits: { fileSize: 20 * 1024 * 1024 } },
);
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
  @UseInterceptors(UPLOAD)
  async compare(@UploadedFiles() files: UploadedFields) {
    const [fileA, fileB] = this.pick(files);
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã so sánh 2 file',
      data: await this.ticketCompareService.compare(fileA.buffer, fileB.buffer),
    };
  }

  /** Xuất kết quả đối chiếu ra file Excel đã định dạng (gửi lại đúng 2 file vừa so; không lưu gì) */
  @Post('export')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(UPLOAD)
  async export(@UploadedFiles() files: UploadedFields) {
    const [fileA, fileB] = this.pick(files);
    const result = await this.ticketCompareService.compare(fileA.buffer, fileB.buffer);
    const buffer = await buildCompareWorkbook(result, {
      a: displayName(fileName(fileA), 'File A'),
      b: displayName(fileName(fileB), 'File B'),
    });
    const day = new Date().toISOString().slice(0, 10);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="doi-chieu-ve-${day}.xlsx"`,
    });
  }

  private pick(files: UploadedFields): [UploadedFileShape, UploadedFileShape] {
    const fileA = files.fileA?.[0];
    const fileB = files.fileB?.[0];
    if (!fileA || !fileB) {
      throw new BadRequestException('Vui lòng chọn đủ 2 file Excel để so sánh.');
    }
    return [fileA, fileB];
  }
}
