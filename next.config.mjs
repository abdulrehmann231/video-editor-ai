/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // transformers.js (local Whisper) pulls native/onnx deps — keep them out of
  // the webpack server bundle so they load at runtime from node_modules.
  experimental: {
    serverComponentsExternalPackages: [
      '@xenova/transformers',
      'onnxruntime-node',
      'sharp',
      'remotion',
      '@remotion/renderer',
      '@remotion/bundler',
      'esbuild',
    ],
  },
  // The R2 public host serves rendered/uploaded media.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: process.env.R2_PUBLIC_HOST || 'videos.abdulrehmann.com' },
    ],
  },
};

export default nextConfig;
