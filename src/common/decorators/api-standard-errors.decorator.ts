import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export const ApiStandardErrorResponses = () => {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'Invalid request data — validation failed',
      schema: {
        example: {
          status: 'error',
          statusCode: 400,
          message: 'Validation failed',
          errors: ['name must be a string'],
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/resource',
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Missing or invalid authentication token',
      schema: {
        example: {
          status: 'error',
          statusCode: 401,
          message: 'Unauthorized',
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions for this action',
      schema: {
        example: {
          status: 'error',
          statusCode: 403,
          message: 'Forbidden',
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'Requested resource was not found',
      schema: {
        example: {
          status: 'error',
          statusCode: 404,
          message: 'Resource not found',
        },
      },
    }),
  );
};
