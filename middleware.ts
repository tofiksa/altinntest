import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle favicon.ico requests to prevent 404 errors
  if (request.nextUrl.pathname === '/favicon.ico') {
    // Redirect to the SVG icon or return a 204 No Content
    return NextResponse.redirect(new URL('/icon.svg', request.url), 301);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/favicon.ico',
};

