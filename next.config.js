/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/challenges',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
