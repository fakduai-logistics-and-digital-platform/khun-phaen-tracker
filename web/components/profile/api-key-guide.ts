import { API_BASE_URL } from "@/lib/api/apis";

/** `API_BASE_URL` can be a same-origin proxy path (e.g. `/kp-api`); agents need an absolute URL. */
export function mcpUrl(origin: string) {
  const base = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${/^https?:\/\//.test(base) ? base : `${origin}${base}`}/mcp`;
}

export function claudeCodeCommand(key: string, url: string) {
  return `claude mcp add --transport http khun-phaen ${url} --header "Authorization: Bearer ${key}"`;
}

export function codexConfig(key: string, url: string) {
  return `# ~/.codex/config.toml
[mcp_servers.khun-phaen]
url = "${url}"
bearer_token_env_var = "KHUN_PHAEN_API_KEY"

# then, in your shell:
export KHUN_PHAEN_API_KEY="${key}"`;
}

export function antigravityConfig(key: string, url: string) {
  return `// Antigravity > Agent panel > ... > MCP Servers > Manage MCP Servers > View raw config
// (~/.gemini/antigravity/mcp_config.json)
{
  "mcpServers": {
    "khun-phaen": {
      "serverUrl": "${url}",
      "headers": {
        "Authorization": "Bearer ${key}"
      }
    }
  }
}`;
}
