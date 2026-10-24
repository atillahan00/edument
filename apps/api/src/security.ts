import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client';
import type { Request } from 'express';
import { Database } from './db';
import { sha256 } from './hash';
export type Actor = {
  id: string;
  name: string;
  role: Role;
  minor: boolean;
  active: boolean;
  memberships: { institutionId: string }[];
};
export type AuthRequest = Request & { user: Actor };
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const Public = () => SetMetadata('public', true);
export function canReview(actor: Actor, institutionId: string) {
  return (
    actor.role === 'ADMIN' ||
    (actor.role === 'VERIFIER' && actor.memberships.some((x) => x.institutionId === institutionId))
  );
}
export function ownsOrAdmin(actor: Actor, ownerId: string) {
  return actor.role === 'ADMIN' || actor.id === ownerId;
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Reflector) private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()])) return true;
    const token = request.cookies?.edument_session;
    if (typeof token !== 'string' || token.length > 100)
      throw new UnauthorizedException('Oturum açmanız gerekiyor.');
    const session = await this.db.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { include: { memberships: true } } },
    });
    if (!session || session.expiresAt < new Date() || !session.user.active)
      throw new UnauthorizedException('Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
    const { passwordHash: _password, email: _email, ...actor } = session.user;
    request.user = actor;
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(actor.role))
      throw new ForbiddenException('Bu işlem için yetkiniz bulunmuyor.');
    return true;
  }
}
