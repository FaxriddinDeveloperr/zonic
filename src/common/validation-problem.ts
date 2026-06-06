// Reproduces ASP.NET ControllerBase.ValidationProblem(ModelState) response shape:
//   { type, title, status, errors: { <field>: [..] } }
import { BadRequestException, ValidationError } from '@nestjs/common';

export function validationProblemBody(errors: Record<string, string[]>) {
  return {
    type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
    title: 'One or more validation errors occurred.',
    status: 400,
    errors,
  };
}

/** Service-level errors (StatusGeneric AddError) — keyed by '' like the original. */
export function badRequest(messages: string[]): BadRequestException {
  return new BadRequestException(validationProblemBody({ '': messages }));
}

/** Global ValidationPipe factory — maps class-validator errors to the ProblemDetails shape. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const map: Record<string, string[]> = {};
  for (const e of errors) {
    map[e.property] = Object.values(e.constraints ?? {});
  }
  return new BadRequestException(validationProblemBody(map));
}
