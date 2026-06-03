import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { InvoicesService } from './invoices.service'
import { EmitInvoicesDto } from './dto/emit-invoices.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('import')
  importFromPosOne(
    @Query('clientId', ParseIntPipe) clientId: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.invoicesService.importFromPosOne(clientId, from, to)
  }

  @Post('emit')
  @HttpCode(HttpStatus.OK)
  emitInvoices(@Body() dto: EmitInvoicesDto) {
    return this.invoicesService.emitInvoices(dto)
  }

  @Get('history')
  findAll(
    @Query('clientId', ParseIntPipe) clientId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.invoicesService.findAll(clientId, page ? +page : 1, pageSize ? +pageSize : 50)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id)
  }

  @Post(':id/check-status')
  @HttpCode(HttpStatus.OK)
  checkStatus(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.checkStatus(id)
  }
}
