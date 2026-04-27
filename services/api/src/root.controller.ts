import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return { status: 'ok', service: 'gestordoc-api' };
  }
}
