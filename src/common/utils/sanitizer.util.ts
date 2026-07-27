export class SanitizerUtil {
  /**
   * Sanitizes input strings by stripping malicious scripts, HTML tags,
   * excessive whitespace, and potential prompt injection delimiters.
   */
  static sanitizeText(input: string): string {
    if (!input) return '';

    // Strip HTML tags & script blocks
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Neutralize common prompt injection syntax (e.g. system instruction overrides, markdown blocks)
    sanitized = sanitized
      .replace(/system:/gi, '[Sanitized System:]')
      .replace(/\[SYSTEM_PROMPT\]/gi, '')
      .replace(/```(?:html|javascript|js|bash|sh|cmd|powershell)?/gi, '');

    // Trim whitespace and limit excessive newlines
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return sanitized;
  }

  /**
   * Encapsulates context strings inside safe XML boundaries to prevent instruction drift.
   */
  static wrapContextSafely(context: string): string {
    const cleanContext = this.sanitizeText(context);
    return `<context>\n${cleanContext}\n</context>`;
  }
}
