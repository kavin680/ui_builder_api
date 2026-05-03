import { PartialType } from '@nestjs/swagger';
import { CreateFreezeConfigurationDto } from './create-freeze-configuration.dto';

export class UpdateFreezeConfigurationDto extends PartialType(
  CreateFreezeConfigurationDto,
) {}
