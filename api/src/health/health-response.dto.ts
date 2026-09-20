export class HealthResponseDto {
  readonly status = "ok" as const;
  readonly version = "1" as const;
}
