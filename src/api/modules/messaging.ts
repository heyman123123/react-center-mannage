import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PageResult } from "../types";
import type { EmailChannelConfig, EmailTemplate, EmailWebhookLog } from "../../types/payment";
import { INITIAL_EMAIL_CHANNELS, INITIAL_EMAIL_WEBHOOKS } from "../../data/mockData";
import { INITIAL_EMAIL_TEMPLATES } from "../../data/emailTemplatesData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export type EmailChannelInput = {
  providerKey?: EmailChannelConfig["providerKey"];
  name: string;
  description?: string;
  mode?: string;
  enabled?: boolean;
  senderEmail: string;
  senderName?: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  dailyQuota?: number;
  verifiedDomain?: string;
  spfDkimStatus?: EmailChannelConfig["spfDkimStatus"];
};

export async function listEmailChannels(mode?: string): Promise<EmailChannelConfig[]> {
  if (USE_MOCK) {
    const list = INITIAL_EMAIL_CHANNELS.map((c) => ({ ...c, mode: c.mode || "live" }));
    if (!mode || mode === "all") return mockResolve(list);
    return mockResolve(list.filter((c) => (c.mode || "live") === mode));
  }
  return http.get<EmailChannelConfig[]>("/email-channels", mode ? { mode } : undefined);
}

export async function createEmailChannel(body: EmailChannelInput): Promise<EmailChannelConfig> {
  if (USE_MOCK) {
    const item: EmailChannelConfig = {
      id: `ec_custom_${Date.now()}`,
      providerKey: body.providerKey || "resend",
      name: body.name,
      description: body.description || "",
      mode: body.mode || "live",
      enabled: true,
      isPrimary: false,
      senderEmail: body.senderEmail,
      senderName: body.senderName || "",
      apiKey: body.apiKey || "",
      smtpHost: body.smtpHost || "",
      smtpPort: body.smtpPort || 587,
      dailyQuota: body.dailyQuota || 50000,
      sentToday: 0,
      verifiedDomain: "",
      spfDkimStatus: "PENDING",
      lastTestedAt: "",
    };
    return mockResolve(item);
  }
  return http.post<EmailChannelConfig>("/email-channels", body);
}

export async function updateEmailChannel(id: string, body: EmailChannelInput): Promise<EmailChannelConfig> {
  if (USE_MOCK) {
    const found = INITIAL_EMAIL_CHANNELS.find((c) => c.id === id);
    return mockResolve({ ...(found || INITIAL_EMAIL_CHANNELS[0]), ...body, id, mode: body.mode || found?.mode || "live" });
  }
  return http.put<EmailChannelConfig>(`/email-channels/${id}`, body);
}

export async function setEmailChannelPrimary(id: string): Promise<EmailChannelConfig> {
  if (USE_MOCK) {
    const found = INITIAL_EMAIL_CHANNELS.find((c) => c.id === id);
    return mockResolve({ ...(found || INITIAL_EMAIL_CHANNELS[0]), isPrimary: true });
  }
  return http.put<EmailChannelConfig>(`/email-channels/${id}/primary`);
}

export async function deleteEmailChannel(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/email-channels/${id}`);
}

export async function testEmailChannel(id: string, recipient: string): Promise<{ messageId: string }> {
  if (USE_MOCK) return mockResolve({ messageId: `mock_${Date.now()}` });
  return http.post<{ messageId: string }>(`/email-channels/${id}/test`, { recipient });
}

export type EmailTemplateInput = Partial<EmailTemplate> & {
  code: string;
  name: string;
  subject: string;
};

export async function listEmailTemplates(keyword?: string): Promise<EmailTemplate[]> {
  if (USE_MOCK) return mockResolve(INITIAL_EMAIL_TEMPLATES);
  return http.get<EmailTemplate[]>("/email-templates", keyword ? { keyword } : undefined);
}

export async function createEmailTemplate(body: EmailTemplateInput): Promise<EmailTemplate> {
  if (USE_MOCK) {
    const item = { ...INITIAL_EMAIL_TEMPLATES[0], ...body, id: `mail_${Date.now()}` } as EmailTemplate;
    return mockResolve(item);
  }
  return http.post<EmailTemplate>("/email-templates", body);
}

export async function updateEmailTemplate(id: string, body: EmailTemplateInput): Promise<EmailTemplate> {
  if (USE_MOCK) {
    const found = INITIAL_EMAIL_TEMPLATES.find((t) => t.id === id);
    return mockResolve({ ...(found || INITIAL_EMAIL_TEMPLATES[0]), ...body, id });
  }
  return http.put<EmailTemplate>(`/email-templates/${id}`, body);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/email-templates/${id}`);
}

export async function listEmailWebhooks(query?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  eventType?: string;
}): Promise<PageResult<EmailWebhookLog>> {
  if (USE_MOCK) {
    return mockResolve({
      list: INITIAL_EMAIL_WEBHOOKS,
      total: INITIAL_EMAIL_WEBHOOKS.length,
      page: 1,
      pageSize: 20,
    });
  }
  return http.get<PageResult<EmailWebhookLog>>("/email-webhooks", query);
}
