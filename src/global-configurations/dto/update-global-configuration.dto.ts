import { PartialType } from '@nestjs/swagger';
import { CreateGlobalConfigurationDto } from './create-global-configuration.dto';

export class UpdateGlobalConfigurationDto extends PartialType(
  CreateGlobalConfigurationDto,
) {}
