import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies['accessToken']; // Извлекаем токен из cookie

    request.headers['authorization'] = `Bearer ${token}`; // Устанавливаем токен в заголовке авторизации

    return super.canActivate(context);
  }
}
