import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/** Cán bộ khảo sát báo vấn đề hiện trường (ISSUE) hoặc xin hỗ trợ (HELP) — BR-78. */
export class ReportIssueDto {
  @IsIn(['ISSUE', 'HELP'])
  kind: 'ISSUE' | 'HELP';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note: string;
}
