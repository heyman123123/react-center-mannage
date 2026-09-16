import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Markdown,
  Section,
  Link,
} from "@react-email/components";
import {
  Laptop,
  Smartphone,
  Copy,
  Check,
  Code2,
  Eye,
  FileText,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { SupportedLanguage, DictionaryEntry } from "../types/payment";

interface ReactEmailRendererProps {
  content: string;
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  previewText?: string;
  language?: SupportedLanguage;
  dictionary?: DictionaryEntry[];
  dynamicTags?: { tag: string; sample: string }[];
  device?: "desktop" | "mobile";
  onDeviceChange?: (device: "desktop" | "mobile") => void;
  showHeader?: boolean;
  compact?: boolean;
}

/**
 * Utility to parse inline JSX styles like: style={{ backgroundColor: '#4f46e5', padding: '12px 24px' }}
 */
function parseStyleObject(styleStr?: string): React.CSSProperties | undefined {
  if (!styleStr) return undefined;
  const style: Record<string, string | number> = {};
  const regex = /([a-zA-Z0-9_-]+)\s*:\s*(['\"][^'\"]*['\"]|[0-9]+(?:\.[0-9]+)?)/g;
  let match;
  while ((match = regex.exec(styleStr)) !== null) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^['\"]|['\"]$/g, "");
    if (!isNaN(Number(val)) && !val.includes("%") && !val.includes("px")) {
      style[key] = Number(val);
    } else {
      style[key] = val;
    }
  }
  return Object.keys(style).length > 0 ? (style as React.CSSProperties) : undefined;
}

/**
 * Simple HTML pretty printer for display in code tab
 */
function formatHtml(html: string): string {
  if (!html) return "";
  let formatted = "";
  let indent = 0;
  const tokens =
    html
      .replace(/>\s*</g, "><")
      .match(/<!--[\s\S]*?-->|<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>|[^<]+/g) || [];

  for (const token of tokens) {
    if (token.startsWith("</")) {
      indent = Math.max(0, indent - 1);
      formatted += "  ".repeat(indent) + token + "\n";
    } else if (
      token.startsWith("<") &&
      !token.startsWith("<!") &&
      !token.endsWith("/>") &&
      !token.startsWith("<?") &&
      !token.startsWith("<img") &&
      !token.startsWith("<input") &&
      !token.startsWith("<hr") &&
      !token.startsWith("<br") &&
      !token.startsWith("<meta")
    ) {
      formatted += "  ".repeat(indent) + token + "\n";
      indent++;
    } else {
      formatted += "  ".repeat(indent) + token + "\n";
    }
  }
  return formatted.trim();
}

/**
 * Convert HTML to plain text fallback
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n$1\n" + "=".repeat(20) + "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, "\n[$1]\n")
    .replace(/<hr[^>]*>/gi, "\n" + "-".repeat(30) + "\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parses email content containing React Email components and Markdown blocks
 */
function buildReactEmailTree(
  rawContent: string,
  isMobile: boolean
): React.ReactElement {
  let text = rawContent.trim();
  let containerStyle: React.CSSProperties | undefined = undefined;

  // Detect and unwrap top-level <Container>...</Container>
  const containerMatch = text.match(
    /^<Container(?:\s+style=\{\{([^}]*)\}\})?[^>]*>([\s\S]*)<\/Container>$/i
  );
  if (containerMatch) {
    containerStyle = parseStyleObject(containerMatch[1]);
    text = containerMatch[2].trim();
  }

  const tagRegex =
    /(<(?:Button|Hr|Section|Heading|Text|Link|Markdown)[\s\S]*?(?:\/>|<\/(?:Button|Section|Heading|Text|Link|Markdown)>))/gi;
  const parts = text.split(tagRegex);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // 1. <Button>
    const btnMatch = part.match(
      /^<Button(?:\s+href=["']([^"']*)["'])?(?:\s+style=\{\{([^}]*)\}\})?[^>]*>([\s\S]*?)<\/Button>$/i
    );
    if (btnMatch) {
      const href = btnMatch[1] || "#";
      const customStyle = parseStyleObject(btnMatch[2]) || {};
      const buttonStyle: React.CSSProperties = {
        backgroundColor: "#4f46e5",
        color: "#ffffff",
        padding: "12px 28px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        textDecoration: "none",
        display: "inline-block",
        textAlign: "center",
        boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
        ...customStyle,
      };
      elements.push(
        <Section key={`btn-${i}`} style={{ textAlign: "center", margin: "22px 0" }}>
          <Button href={href} style={buttonStyle}>
            {btnMatch[3] || "Click Here"}
          </Button>
        </Section>
      );
      continue;
    }

    // 2. <Hr />
    const hrMatch = part.match(/^<Hr(?:\s+style=\{\{([^}]*)\}\})?[^>]*\/?>$/i);
    if (hrMatch) {
      const customStyle = parseStyleObject(hrMatch[1]) || {};
      elements.push(
        <Hr
          key={`hr-${i}`}
          style={{
            borderColor: "#e5e7eb",
            margin: "20px 0",
            borderWidth: "1px",
            borderStyle: "solid",
            ...customStyle,
          }}
        />
      );
      continue;
    }

    // 3. <Heading>
    const headMatch = part.match(
      /^<Heading(?:\s+as=["']([^"']*)["'])?(?:\s+style=\{\{([^}]*)\}\})?[^>]*>([\s\S]*?)<\/Heading>$/i
    );
    if (headMatch) {
      const as = (headMatch[1] as "h1" | "h2" | "h3" | "h4" | "h5" | "h6") || "h2";
      const customStyle = parseStyleObject(headMatch[2]) || {};
      elements.push(
        <Heading
          key={`head-${i}`}
          as={as}
          style={{
            color: "#111827",
            fontSize: as === "h1" ? "24px" : as === "h2" ? "20px" : "16px",
            fontWeight: "700",
            margin: "18px 0 10px 0",
            lineHeight: "1.3",
            ...customStyle,
          }}
        >
          {headMatch[3]}
        </Heading>
      );
      continue;
    }

    // 4. <Section>
    const secMatch = part.match(
      /^<Section(?:\s+style=\{\{([^}]*)\}\})?[^>]*>([\s\S]*?)<\/Section>$/i
    );
    if (secMatch) {
      const customStyle = parseStyleObject(secMatch[1]) || {};
      const innerTree = buildReactEmailTree(secMatch[2], isMobile);
      elements.push(
        <Section
          key={`sec-${i}`}
          style={{
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            border: "1px solid #f3f4f6",
            margin: "14px 0",
            ...customStyle,
          }}
        >
          {innerTree}
        </Section>
      );
      continue;
    }

    // 5. <Text>
    const textMatch = part.match(
      /^<Text(?:\s+style=\{\{([^}]*)\}\})?[^>]*>([\s\S]*?)<\/Text>$/i
    );
    if (textMatch) {
      const customStyle = parseStyleObject(textMatch[1]) || {};
      elements.push(
        <Text
          key={`txt-${i}`}
          style={{
            color: "#4b5563",
            fontSize: "14px",
            lineHeight: "24px",
            margin: "8px 0",
            ...customStyle,
          }}
        >
          {textMatch[2]}
        </Text>
      );
      continue;
    }

    // 6. Markdown Block
    const trimmed = part.trim();
    if (trimmed) {
      elements.push(
        <Section key={`md-${i}`} style={{ margin: "10px 0" }}>
          <Markdown
            markdownContainerStyles={{
              color: "#374151",
              fontSize: "14px",
              lineHeight: "1.65",
            }}
          >
            {trimmed}
          </Markdown>
        </Section>
      );
    }
  }

  const defaultContainerStyle: React.CSSProperties = {
    maxWidth: isMobile ? "375px" : "600px",
    width: "100%",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    padding: isMobile ? "20px 16px" : "32px 28px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    ...containerStyle,
  };

  return <Container style={defaultContainerStyle}>{elements}</Container>;
}

export const ReactEmailRenderer: React.FC<ReactEmailRendererProps> = ({
  content,
  subject,
  senderName = "NovasPay Notifications",
  senderEmail = "notify@novaspay.global",
  previewText,
  language = "en-US",
  dictionary = [],
  dynamicTags = [],
  device: controlledDevice,
  onDeviceChange,
  showHeader = true,
  compact = false,
}) => {
  const { t } = useTranslation(["email", "common"]);
  const [internalDevice, setInternalDevice] = useState<"desktop" | "mobile">("desktop");
  const device = controlledDevice ?? internalDevice;
  const setDevice = onDeviceChange ?? setInternalDevice;

  const [viewTab, setViewTab] = useState<"visual" | "html" | "text">("visual");
  const [copiedHtml, setCopiedHtml] = useState(false);

  // 1. Resolve dynamic variables & dictionary in text
  const resolvedContent = useMemo(() => {
    let text = content;
    // Replace dynamic sample tags
    dynamicTags.forEach((tag) => {
      text = text.replaceAll(tag.tag, tag.sample);
    });
    // Replace dictionary tags
    dictionary.forEach((dictEntry) => {
      const dictTag = `{{dict.${dictEntry.key}}}`;
      const translation =
        dictEntry.translations[language] ||
        dictEntry.translations["en-US"] ||
        dictEntry.key;
      text = text.replaceAll(dictTag, translation);
    });
    return text;
  }, [content, dynamicTags, dictionary, language]);

  // 2. Build the React Email tree using @react-email/components
  const reactEmailTree = useMemo(() => {
    return buildReactEmailTree(resolvedContent, device === "mobile");
  }, [resolvedContent, device]);

  // 3. Compile static production HTML using renderToStaticMarkup
  const compiledHtml = useMemo(() => {
    try {
      return renderToStaticMarkup(reactEmailTree);
    } catch {
      return `<div style="color:red">Error compiling React Email</div>`;
    }
  }, [reactEmailTree]);

  // 4. Formatted HTML for the Code tab
  const formattedHtml = useMemo(() => formatHtml(compiledHtml), [compiledHtml]);

  // 5. Plain text version
  const plainText = useMemo(() => htmlToPlainText(compiledHtml), [compiledHtml]);

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(formattedHtml);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-subtle/40 rounded-xl border border-line/80 overflow-hidden shadow-xs">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-line gap-2 flex-wrap text-xs">
        {/* View Mode Tabs (Visual / HTML / Text) */}
        <div className="flex items-center bg-hover/80 p-0.5 rounded-lg border border-line/50">
          <button
            type="button"
            onClick={() => setViewTab("visual")}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewTab === "visual"
                ? "bg-surface text-indigo-600 shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t("templates.reactEmail.tabVisual")}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("html")}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewTab === "html"
                ? "bg-surface text-indigo-600 shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{t("templates.reactEmail.tabHtml")}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("text")}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewTab === "text"
                ? "bg-surface text-indigo-600 shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t("templates.reactEmail.tabText")}</span>
          </button>
        </div>

        {/* Right controls: Device Switcher + Resend React Email Badge */}
        <div className="flex items-center gap-2">
          {viewTab === "visual" && (
            <div className="flex items-center bg-hover/80 p-0.5 rounded-lg border border-line/50">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                title={t("templates.reactEmail.desktop")}
                className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  device === "desktop"
                    ? "bg-surface text-fg shadow-card font-medium"
                    : "text-fg-tertiary hover:text-fg"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                {!compact && <span className="text-[11px]">{t("templates.reactEmail.desktop")}</span>}
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                title={t("templates.reactEmail.mobile")}
                className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  device === "mobile"
                    ? "bg-surface text-fg shadow-card font-medium"
                    : "text-fg-tertiary hover:text-fg"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                {!compact && <span className="text-[11px]">{t("templates.reactEmail.mobile")}</span>}
              </button>
            </div>
          )}

          {viewTab === "html" && (
            <button
              type="button"
              onClick={handleCopyHtml}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHtml ? t("templates.reactEmail.copiedHtml") : t("templates.reactEmail.copyHtml")}</span>
            </button>
          )}

          {/* Official React Email Badge */}
          <a
            href="https://github.com/resend/react-email"
            target="_blank"
            rel="noreferrer"
            title={t("templates.reactEmail.badgeTooltip")}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white rounded-md text-[10px] font-mono tracking-tight hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>react-email</span>
            <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* Main Preview Canvas / Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center">
        {/* Visual Render Mode */}
        {viewTab === "visual" && (
          <div
            className={`w-full transition-all duration-200 ${
              device === "desktop" ? "max-w-[620px]" : "max-w-[395px]"
            }`}
          >
            {/* Simulated Mail Client Header */}
            {showHeader && (
              <div className="bg-surface rounded-t-xl border border-line border-b-0 p-3 text-xs space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-[11px] text-fg-tertiary">
                  <span className="font-semibold text-fg-secondary">
                    {senderName} &lt;{senderEmail}&gt;
                  </span>
                  <span className="text-[10px] bg-subtle px-1.5 py-0.5 rounded text-fg-secondary">
                    {device === "desktop" ? "Desktop (600px)" : "Mobile (375px)"}
                  </span>
                </div>
                {subject && (
                  <div className="font-bold text-fg text-sm tracking-tight pt-0.5">
                    {subject}
                  </div>
                )}
                {previewText && (
                  <div className="text-[11px] text-fg-tertiary italic">
                    {previewText}
                  </div>
                )}
              </div>
            )}

            {/* Email Canvas Rendered by @react-email/components */}
            <div
              className={`bg-white text-zinc-900 shadow-md transition-all overflow-hidden ${
                showHeader ? "rounded-b-xl border border-line" : "rounded-xl border border-line"
              }`}
            >
              {reactEmailTree}
            </div>
          </div>
        )}

        {/* HTML Source Code Mode */}
        {viewTab === "html" && (
          <div className="w-full max-w-4xl space-y-2">
            <div className="text-[11px] text-fg-secondary bg-surface p-2.5 rounded-lg border border-line flex items-center justify-between">
              <span>{t("templates.reactEmail.htmlViewNote")}</span>
              <button
                type="button"
                onClick={handleCopyHtml}
                className="px-2 py-0.5 text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                {t("templates.reactEmail.copyHtml")}
              </button>
            </div>
            <div className="relative bg-zinc-900 text-zinc-100 p-4 rounded-xl border border-zinc-800 text-xs font-mono overflow-x-auto max-h-[600px] shadow-inner">
              <pre className="whitespace-pre">{formattedHtml}</pre>
            </div>
          </div>
        )}

        {/* Plain Text Mode */}
        {viewTab === "text" && (
          <div className="w-full max-w-2xl bg-surface p-4 rounded-xl border border-line text-xs font-mono text-fg whitespace-pre-wrap leading-relaxed shadow-card">
            {plainText}
          </div>
        )}
      </div>
    </div>
  );
};
