// Password-gates the owner's internal staff tool (staff.html) on Vercel so only
// people with the username/password can load it. Everything else on the site
// stays public.
//
// reports.html (the report generator) is NOT gated any more: report writers open it
// from their job card, and it already sends anyone who isn't logged in (owner login
// or contractor login) to the login page. All data it uses comes through the Worker,
// which checks those logins itself, so a browser password here only blocked writers.
//
// The username/password live as Environment Variables in the Vercel project
// (STAFF_SITE_USER / STAFF_SITE_PASS), never in this repo.

export const config = {
  matcher: ['/staff.html'],
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
