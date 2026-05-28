import { PartialType } from '@nestjs/swagger';
import { CreateCourierProfileDto } from './create-courier-profile.dto';

export class UpdateCourierProfileDto extends PartialType(CreateCourierProfileDto) {}
