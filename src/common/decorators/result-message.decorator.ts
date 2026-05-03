import { SetMetadata } from '@nestjs/common';

export const RESULT_MESSAGE_KEY = 'resultMessage';
export const ResultMessage = (message: string) =>
  SetMetadata(RESULT_MESSAGE_KEY, message);
