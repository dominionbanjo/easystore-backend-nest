export function isDevEnvironment(): boolean {
  return (process.env.NODE_ENV ?? '').trim() === 'development';
}

export function getCorsOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp | undefined)[] = [
    process.env.FRONTEND_URL,
    'https://eazystore.com.ng',
    new RegExp('^https://([a-zA-Z0-9-]+\\.)?eazystore\\.com\\.ng$'),
    'https://easy-store-liard.vercel.app',
  ];

  return origins.filter((origin): origin is string | RegExp => Boolean(origin));
}
