import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QueryDto {
  @IsNotEmpty({ message: 'Question prompt cannot be empty.' })
  @IsString({ message: 'Question must be a string.' })
  @MaxLength(1000, { message: 'Question cannot exceed 1000 characters.' })
  question: string;
}
