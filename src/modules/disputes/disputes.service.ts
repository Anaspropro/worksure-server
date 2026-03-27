import { Injectable } from '@nestjs/common';
import { DOMAIN_DEFINITIONS } from '../../common/constants/architecture-summary';

@Injectable()
export class DisputesService {
  getDefinition() {
    return DOMAIN_DEFINITIONS.find((domain) => domain.name === 'disputes');
  }
}
