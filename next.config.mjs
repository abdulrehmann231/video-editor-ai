/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The R2 public host serves rendered/uploaded media.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: process.env.R2_PUBLIC_HOST || 'videos.abdulrehmann.com' },
    ],
  },
};

export default nextConfig;
