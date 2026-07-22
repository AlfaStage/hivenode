import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('hivenode_token')?.value;
  const path = request.nextUrl.pathname;

  // Redireciona usuários não logados das rotas privadas
  if (!token && (path.startsWith('/saas') || path.startsWith('/miner'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // TODO: Em um cenário real, decodificaria o JWT para pegar a Role/Persona
  // Aqui assumiremos que a separação ocorrerá via interface baseada em cookies ou BD.
  // Como as rotas foram desmembradas, o middleware garante que ao menos haja token.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/saas/:path*', '/miner/:path*'],
};
