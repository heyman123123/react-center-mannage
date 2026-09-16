import { http } from "../request";
import type { PageResult } from "../types";
import type { EmailChannelConfig, EmailTemplate, EmailWebhookLog } from "../../types/payment";

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
  return http.get<EmailChannelConfig[]>("/email-channels", mode ? { mode } : undefined);
}

export async function createEmailChannel(body: EmailChannelInput): Promise<EmailChannelConfig> {
  return http.post<EmailChannelConfig>("/email-channels", body);
}

export async function updateEmailChannel(id: string, body: EmailChannelInput): Promise<EmailChannelConfig> {
  return http.put<EmailChannelConfig>(`/email-channels/${id}`, body);
}

export async function setEmailChannelPrimary(id: string): Promise<EmailChannelConfig> {
  return http.put<EmailChannelConfig>(`/email-channels/${id}/primary`);
}

export async function deleteEmailChannel(id: string): Promise<void> {
  await http.delete(`/email-channels/${id}`);
}

export async function testEmailChannel(id: string, recipient: string): Promise<{ messageId: string }> {
  return http.post<{ messageId: string }>(`/email-channels/${id}/test`, { recipient });
}

export type EmailTemplateInput = Partial<EmailTemplate> & {
  code: string;
  name: string;
  subject: string;
};

export async function listEmailTemplates(keyword?: string): Promise<EmailTemplate[]> {
  return http.get<EmailTemplate[]>("/email-templates", keyword ? { keyword } : undefined);
}

export async function createEmailTemplate(body: EmailTemplateInput): Promise<EmailTemplate> {
  return http.post<EmailTemplate>("/email-templates", body);
}

export async function updateEmailTemplate(id: string, body: EmailTemplateInput): Promise<EmailTemplate> {
  return http.put<EmailTemplate>(`/email-templates/${id}`, body);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await http.delete(`/email-templates/${id}`);
}

export async function listEmailWebhooks(query?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  eventType?: string;
}): Promise<PageResult<EmailWebhookLog>> {
  return http.get<PageResult<EmailWebhookLog>>("/email-webhooks", query);
}
