import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Achievement]: logro desbloqueado por un usuario | [Patron]: Entity (DDD) | [Principio]: SRP | [Paradigma]: POO

// [Codigos de logros]: catalogo cerrado | [Patron]: Policy
export enum AchievementCode {
  FIRST_QUIZ = 'first_quiz',
  PERFECT_SCORE = 'perfect_score',
  STREAK_3 = 'streak_3',
  STREAK_10 = 'streak_10',
  SPEED_DEMON = 'speed_demon',
  POINTS_1000 = 'points_1000',
  POINTS_5000 = 'points_5000',
}

@Entity({ name: 'achievements' })
@Index(['userId'])
@Index(['code'])
@Index(['userId', 'code'], { unique: true })
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: AchievementCode })
  code!: AchievementCode;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt!: Date;
}
