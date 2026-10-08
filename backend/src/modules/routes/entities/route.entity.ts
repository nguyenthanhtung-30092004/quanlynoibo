import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Tên hiển thị, ví dụ "Hà Nội - Cẩm Phả" */
  @Column({ unique: true, length: 255 })
  name: string;

  @Column({ length: 100 })
  origin: string;

  @Column({ length: 100 })
  destination: string;

  /** Giá vé mặc định (VNĐ), dùng để điền sẵn khi bán vé */
  @Column({ name: 'defaultPrice', type: 'int', default: 0 })
  defaultPrice: number;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
