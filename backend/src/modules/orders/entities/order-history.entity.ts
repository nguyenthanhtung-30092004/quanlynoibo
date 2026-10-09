import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OrderHistoryAction = 'CREATE' | 'UPDATE' | 'CANCEL' | 'SEND_MESSAGE';

/** Một thay đổi của một trường: giá trị cũ -> giá trị mới */
export interface OrderChange {
  field: string;
  label: string;
  from: string | number | null;
  to: string | number | null;
}

/** Lịch sử thao tác trên đơn: ai làm gì, lúc nào, thay đổi những gì */
@Entity('order_history')
export class OrderHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'orderId', type: 'int' })
  orderId: number;

  @Column({ name: 'action', type: 'varchar', length: 20 })
  action: OrderHistoryAction;

  /** Người thao tác; lưu kèm tên tại thời điểm đó để còn đọc được dù tài khoản bị xóa/đổi tên */
  @Column({ name: 'actorId', type: 'int', nullable: true })
  actorId: number | null;

  @Column({ name: 'actorName', type: 'varchar', length: 100, default: '' })
  actorName: string;

  @Column({ name: 'summary', type: 'varchar', length: 255, nullable: true })
  summary: string | null;

  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: OrderChange[] | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;
}
