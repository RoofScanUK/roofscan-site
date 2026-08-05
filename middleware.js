// Password-gates the internal staff tools (staff.html and reports.html) so only
// people with the username/password can load them. Everything else on the site
// (the public marketing pages, my-roof.html client portal, trade-portal.html,
// booking pages, etc.) is untouched and stays fully public.
//
// The username/password are NOT stored here — they live as Environment
// Variables in the Vercel project (STAFF_SITE_USER / STAFF_SITE_PASS), set in
// Project Settings > Environment Variables, so they never sit in this repo.

export const config = {
  matcher: ['/staff.html', '/reports.html'],
};

export default function middleware(request) {
  const expectedUser = process.env.STAFF_SITE_USER;
  const expectedPass = process.env.STAFF_SITE_PASS;

  // If the env vars haven't been set yet in Vercel, fail closed (block access)
  // rather than accidentally leaving the page open.
  if (!expectedUser || !expectedPass) {
    return new Response('Staff access is not configured yet.', { status: 503 });
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Basic ')) {
    const encoded = authHeader.slice(6);
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch (e) {
      decoded = '';
    }
    const sepIndex = decoded.indexOf(':');
    const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : '';
    const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : '';
    if (user === expectedUser && pass === expectedPass) {
      return; // credentials correct — let the request through
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="RoofScan Staff Tools"',
    },
  });
}
