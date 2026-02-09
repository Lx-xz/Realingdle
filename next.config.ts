import type { NextConfig } from "next"

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1]
const isProd = process.env.NODE_ENV === "production"
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH
const normalizedBasePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath
    : `/${rawBasePath}`
  : undefined
const basePath = isProd ? normalizedBasePath ?? (repoName ? `/${repoName}` : "/realingdle") : undefined

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
}

export default nextConfig