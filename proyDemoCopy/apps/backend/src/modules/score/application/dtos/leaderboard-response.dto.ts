import { ApiProperty } from '@nestjs/swagger';
// [DTO Leaderboard]: response del ranking | [Patron]: DTO | [Principio]: ISP

export class LeaderboardEntryDto {
  @ApiProperty() rank!: number;
  @ApiProperty() userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() totalPoints!: number;
  @ApiProperty() quizzesCompleted!: number;
  @ApiProperty() avgAccuracy!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];
}
