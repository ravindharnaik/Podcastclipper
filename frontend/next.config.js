/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  reactStrictMode: false, // Disable strict mode to reduce hydration warnings
}

module.exports = nextConfig
