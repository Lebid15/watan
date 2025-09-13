// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';

import { PriceGroup } from '../products/price-group.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrenciesModule } from '../currencies/currencies.module'; 
import { NotificationsModule } from '../notifications/notifications.module'; 
import { SiteSetting } from '../admin/site-setting.entity';
import { PagesController } from './pages.controller';

@Module({
  imports: [
  // Explicitly include Currency so relations (user.currency) are registered even in test sqlite autoLoadEntities edge cases
  TypeOrmModule.forFeature([User, PriceGroup, SiteSetting, Currency]),
    CurrenciesModule,
    NotificationsModule,
  ],
  providers: [UserService],
  controllers: [UserController, PagesController],
  exports: [UserService],
})
export class UserModule {}
