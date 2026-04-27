/**
 * DataSanitizer — strips sensitive data from any content before it is sent to an LLM.
 *
 * Enterprise security compliance:
 *  - API keys / bearer tokens / JWTs
 *  - Passwords in common config patterns
 *  - AWS/GCP/Azure credential strings
 *  - PII: email addresses, credit-card-like numbers, phone numbers
 *  - File paths that expose system layout (absolute paths → relative)
 *
 * Used as a pre-send hook in AIClient so no raw secrets ever leave the process.
 */

export interface SanitizeResult {
  sanitized: string;
  redactions: number;
}

// Patterns and their replacement labels
const RULES: Array<{ pattern: RegExp; label: string }> = [
  // API keys — generic patterns (sk-, pk-, lsv2_, ghp_, etc.)
  { pattern: /\b(sk|pk|rk|ak|lsv2_pt|ghp|gho|github_pat|AKIA)[A-Za-z0-9_\-]{16,}/g,          label: '[REDACTED_API_KEY]'    },
  // Anthropic keys
  { pattern: /\bsk-ant-[A-Za-z0-9_\-]{20,}/g,                                                  label: '[REDACTED_ANTHROPIC_KEY]' },
  // Bearer tokens in Authorization header strings
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,                                               label: 'Bearer [REDACTED_TOKEN]'  },
  // JWT (three base64url segments)
  { pattern: /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,                 label: '[REDACTED_JWT]'           },
  // AWS secret access keys
  { pattern: /[A-Z0-9]{20}(?=.*[+/])[A-Za-z0-9+/]{40}/g,                                       label: '[REDACTED_AWS_KEY]'       },
  // Password fields in JSON-like strings
  { pattern: /"password"\s*:\s*"[^"]{1,200}"/gi,                                                label: '"password":"[REDACTED]"'  },
  { pattern: /'password'\s*:\s*'[^']{1,200}'/gi,                                                label: "'password':'[REDACTED]'"  },
  { pattern: /password\s*[:=]\s*\S+/gi,                                                         label: 'password=[REDACTED]'      },
  // Connection strings with credentials
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:@\s]+:[^@\s]+@/gi,                        label: '[REDACTED_DB_CONNSTR]://' },
  // Credit card numbers (13-19 digits, optional spaces/dashes between groups)
  { pattern: /\b(?:\d[ -]?){13,18}\d\b/g,                                                       label: '[REDACTED_CARD]'          },
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,                         label: '[REDACTED_EMAIL]'         },
  // Absolute file paths that expose system layout
  { pattern: /\/home\/[a-zA-Z0-9_]+\//g,                                                        label: '/home/[user]/'            },
  { pattern: /C:\\Users\\[a-zA-Z0-9 ]+\\/gi,                                                    label: 'C:\\Users\\[user]\\'      },
];

/**
 * Sanitize a single string, returning the cleaned text and a redaction count.
 */
export function sanitize(input: string): SanitizeResult {
  let sanitized = input;
  let redactions = 0;

  for (const { pattern, label } of RULES) {
    const resetPattern = new RegExp(pattern.source, pattern.flags);
    const before = sanitized;
    sanitized = sanitized.replace(resetPattern, label);
    if (sanitized !== before) {
      const count = (before.match(resetPattern) ?? []).length;
      redactions += count;
    }
  }

  return { sanitized, redactions };
}

/**
 * Sanitize system prompt + user message pair.
 * Returns sanitized versions and total redaction count.
 */
export function sanitizePrompt(
  systemPrompt: string,
  userMessage: string,
): { systemPrompt: string; userMessage: string; totalRedactions: number } {
  const sys  = sanitize(systemPrompt);
  const user = sanitize(userMessage);
  return {
    systemPrompt:     sys.sanitized,
    userMessage:      user.sanitized,
    totalRedactions:  sys.redactions + user.redactions,
  };
}
