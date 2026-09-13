# syntax=docker/dockerfile:1
#
# WaveSpeed Prompt Generator — static SPA served by nginx.
# BYOK (browser): paste OpenRouter/Venice keys in the LLM Settings panel for
# the enhancer's direct-API fallback. No secrets are baked into this image —
# only the contents of public/ are copied.
#
# Build: docker build -t wavespeed-prompt-generator .
# Run:   docker run --rm -p 8000:80 wavespeed-prompt-generator
# Open:  http://localhost:8000
#
# Note: generation + catalog routes (/api/generate, /api/models, …) require
# the Worker backend (WAVESPEED_API_KEY lives server-side), so use
# `wrangler dev` (reads .dev.vars) or `wrangler deploy` for the full app.
# This image is for static preview only.
#
# Full backend: deploy to Cloudflare with `wrangler deploy` instead.

FROM nginx:alpine

# SPA assets only — .env / .dev.vars / node_modules never enter the image
COPY public/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
