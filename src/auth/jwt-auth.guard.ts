import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies['accessToken'];

    if (!accessToken) {
      throw new UnauthorizedException('Access token not found');
    }

    try {
      const decodedAccessToken = jwt.verify(
        accessToken,
        process.env.JWT_SECRET,
      ) as {
        walletAddress: string;
        exp: number;
      };

      request.headers['authorization'] = `Bearer ${accessToken}`;
      return true;
    } catch (error) {
      console.log(error.message);
      throw new UnauthorizedException();
    }
  }
}
