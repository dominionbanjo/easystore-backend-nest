import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { SchoolZone } from './entities/school-zone.entity';
import { SchoolZoneAdmin } from './entities/school-zone-admin.entity';
import { SchoolZoneMember } from './entities/school-zone-member.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { SchoolZoneController } from './controllers/school-zone.controller';
import { SchoolZoneService } from './services/school-zone.service';
import { SchoolZoneMemberService } from './services/school-zone-member.service';
import { ZoneAdminGuard } from './guards/zone-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolZone,
      SchoolZoneAdmin,
      SchoolZoneMember,
      Store,
      Product,
      Wishlist,
    ]),
    CacheModule,
    StoreModule,
  ],
  controllers: [SchoolZoneController],
  providers: [
    SchoolZoneService,
    SchoolZoneMemberService,
    ZoneAdminGuard,
  ],
  exports: [SchoolZoneService, SchoolZoneMemberService],
})
export class SchoolZoneModule {}
