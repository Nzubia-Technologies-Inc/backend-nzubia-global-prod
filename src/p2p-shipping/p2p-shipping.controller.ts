import { Controller } from '@nestjs/common';
import { P2pShippingService } from './p2p-shipping.service';

@Controller('p2p-shipping')
export class P2pShippingController {
    constructor(private readonly p2pShippingService: P2pShippingService) {}
}
