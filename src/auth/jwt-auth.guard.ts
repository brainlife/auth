import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    console.log('JwtAuthGuard: Before authentication check');

    // Call the parent canActivate method
    const canActivateResult = super.canActivate(context);
    console.log('canActivateResult', canActivateResult);
    console.log('JwtAuthGuard: After authentication check');

    return canActivateResult;
  }
}
