// web/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('hivenode-token')?.value;
  const path = request.nextUrl.pathname;

  if (!token && (path.startsWith('/saas') || path.startsWith('/miner'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!token && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && path.startsWith('/admin')) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (payload.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/saas/:path*', '/miner/:path*', '/admin/:path*'],
};
