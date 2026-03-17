import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
optimizePackageImports: [
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-heading',
      '@tiptap/extension-code-block',
      '@tiptap/extension-blockquote',
      '@tiptap/extension-strike',
    ],
  },
};

export default nextConfig;
