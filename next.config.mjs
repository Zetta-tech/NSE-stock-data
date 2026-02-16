/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["stock-nse-india"],
  },
};

export default nextConfig;
