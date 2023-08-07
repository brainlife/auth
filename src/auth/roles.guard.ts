// roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasScope } from '../utils/common.utils';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    console.log(
      'RolesGuard canActivate',
      this.reflector.get<string>('roles', context.getHandler()),
    );

    const requiredRole = this.reflector.get<string>(
      'roles',
      context.getHandler(),
    ); // Retrieve the required role from metadata
    if (!requiredRole) {
      return true; // No role required, so allow access.
    }

    const request = context.switchToHttp().getRequest();
    // console.log('RolesGuard canActivate request.user', request.user);
    // console.log('hasScopeValue check', hasScope(request.user, requiredRole));
    return hasScope(request.user, requiredRole);
  }
}
