import { EmailTemplate } from "../types/payment";

// 独立单一邮件列表 - 每封邮件归属独立单一语言，具备独立代码、主题与正文
export const INITIAL_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "mail_receipt_en",
    code: "RECEIPT_WELCOME_EN",
    name: "首次订阅支付成功收据 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "BILLING",
    description: "用户首次购买或续费订阅成功后，即时下发的欢迎信与官方财务收据",
    triggerEvent: "charge.succeeded",
    subject: "Welcome to {{app_name}}! Receipt & Subscription Confirmation ({{order_id}})",
    senderName: "NovasPay Billing Receipt",
    senderEmail: "receipts@novaspay.global",
    previewText: "Your subscription is now active. Here is your official payment receipt.",
    contentMarkdown: `### Hi {{customer_name}},

Thank you for subscribing to **{{app_name}}**! Your payment has been successfully processed and your subscription is now active.

#### 🧾 Transaction Receipt
- **Plan:** {{plan_name}}
- **Amount Paid:** \${{amount}} {{currency}}
- **Payment Method:** {{payment_method}}
- **Invoice Number:** {{order_id}}
- **Billing Period:** {{billing_period}}
- **Next Renewal Date:** {{next_renewal_date}}

You can manage your subscription, download official VAT invoices, or update your payment details at any time in your **[Account Billing Portal]({{billing_portal_url}})**.

{{dict.support.contact_247}}

Best regards,  
The {{app_name}} Billing & Success Team

---
{{dict.email.footer.unsubscribe}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-05 10:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "order_id", "billing_period", "next_renewal_date", "billing_portal_url"],
    dictReferences: ["support.contact_247", "email.footer.unsubscribe"],
  },
  {
    id: "mail_receipt_zh",
    code: "RECEIPT_WELCOME_ZH",
    name: "首次订阅支付成功收据 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "BILLING",
    description: "用户首次购买或续费订阅成功后，即时下发的欢迎信与官方财务收据",
    triggerEvent: "charge.succeeded",
    subject: "【支付成功收据】感谢您订阅 {{app_name}}，电子账单已开具 (单号: {{order_id}})",
    senderName: "NovasPay 账单收据中心",
    senderEmail: "receipts@novaspay.global",
    previewText: "您的出海服务订阅已即时开通，点击查看受认可的官方电子付款凭证。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

感谢您订阅 **{{app_name}}**！您的款项已通过聚合支付网关安全结算，会员服务与专属权益已即刻生效。

#### 🧾 交易对账收据
- **已购方案：** {{plan_name}}
- **实付金额：** {{currency}} {{amount}}
- **支付渠道：** {{payment_method}}
- **官方收据单号：** {{order_id}}
- **计费周期：** {{billing_period}}
- **下次自动续费：** {{next_renewal_date}}

您可以随时登录 **[商户账务服务门户]({{billing_portal_url}})** 下载正式 PDF 电子发票凭证，或管理您的付款信用卡。

{{dict.support.contact_247}}

顺祝商祺，  
{{app_name}} 财务清算中心

---
{{dict.email.footer.unsubscribe}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-05 10:15:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "order_id", "billing_period", "next_renewal_date", "billing_portal_url"],
    dictReferences: ["support.contact_247", "email.footer.unsubscribe"],
  },
  {
    id: "mail_receipt_ja",
    code: "RECEIPT_WELCOME_JA",
    name: "定期決済完了・電子領収書通知 (日本語)",
    language: "ja-JP",
    languageLabel: "日本語 (ja-JP)",
    category: "BILLING",
    description: "日本国内ユーザー向けの決済完了メール兼適格簡易領収書",
    triggerEvent: "charge.succeeded",
    subject: "【領収書】{{app_name}} ご利用料金のお支払い完了のお知らせ（注文番号: {{order_id}}）",
    senderName: "NovasPay お支払い管理",
    senderEmail: "receipts-jp@novaspay.global",
    previewText: "お支払いが正常に完了いたしました。電子領収書の内容をご確認ください。",
    contentMarkdown: `### {{customer_name}} 様

いつも **{{app_name}}** をご利用いただき誠にありがとうございます。  
お客様の定期契約料金のお支払いが正常に完了いたしました。

#### 🧾 ご利用明細・領収情報
- **ご契約プラン：** {{plan_name}}
- **決済金額：** {{currency}} {{amount}}（税込）
- **お支払い方法：** {{payment_method}}
- **領収書番号：** {{order_id}}
- **契約対象期間：** {{billing_period}}
- **次回自動更新予定日：** {{next_renewal_date}}

PDF形式の適格請求書・領収書の発行や登録カード情報の変更は、**[マイページ・請求管理ポータル]({{billing_portal_url}})** よりいつでもご確認いただけます。

{{dict.support.contact_247}}

今後とも {{app_name}} をよろしくお願い申し上げます。  
{{app_name}} カスタマーサポートチーム`,
    status: "ACTIVE",
    updatedAt: "2026-09-05 10:30:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "order_id", "billing_period", "next_renewal_date", "billing_portal_url"],
    dictReferences: ["support.contact_247"],
  },
  {
    id: "mail_receipt_de",
    code: "RECEIPT_WELCOME_DE",
    name: "Zahlungsbestätigung und Beleg (Deutsch)",
    language: "de-DE",
    languageLabel: "Deutsch (de-DE)",
    category: "BILLING",
    description: "Offizieller Zahlungsbeleg für deutsche Geschäftskunden",
    triggerEvent: "charge.succeeded",
    subject: "Willkommen bei {{app_name}}! Zahlungsbestätigung und Beleg ({{order_id}})",
    senderName: "NovasPay Buchhaltung",
    senderEmail: "billing-de@novaspay.global",
    previewText: "Ihr Abonnement ist jetzt aktiv. Hier ist Ihr offizieller Zahlungsbeleg.",
    contentMarkdown: `### Hallo {{customer_name}},

vielen Dank für Ihr Abonnement bei **{{app_name}}**! Ihre Zahlung wurde erfolgreich verarbeitet und Ihr Zugang ist ab sofort freigeschaltet.

#### 🧾 Rechnungsdetails
- **Tarif:** {{plan_name}}
- **Bezahlter Betrag:** {{amount}} {{currency}}
- **Zahlungsmethode:** {{payment_method}}
- **Belegnummer:** {{order_id}}
- **Abrechnungszeitraum:** {{billing_period}}
- **Nächste Verlängerung:** {{next_renewal_date}}

Sie können Ihr Abonnement jederzeit in Ihrem **[Kunden-Portal]({{billing_portal_url}})** verwalten oder steuerkonforme Rechnungen herunterladen.

Mit freundlichen Grüßen  
Ihr {{app_name}} Team`,
    status: "ACTIVE",
    updatedAt: "2026-09-05 10:45:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "order_id", "billing_period", "next_renewal_date", "billing_portal_url"],
  },
  {
    id: "mail_renewal_en",
    code: "RENEWAL_CONFIRM_EN",
    name: "订阅周期自动续费凭证 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "LIFECYCLE",
    description: "周期订阅扣款成功时，向用户下发自动续订确认与新周期权益说明",
    triggerEvent: "invoice.paid",
    subject: "Your {{app_name}} subscription has renewed successfully",
    senderName: "NovasPay Subscriptions",
    senderEmail: "subscriptions@novaspay.global",
    previewText: "We have processed your scheduled subscription renewal for {{plan_name}}.",
    contentMarkdown: `### Hi {{customer_name}},

This is a confirmation that your **{{app_name}}** subscription has automatically renewed.

- **Plan:** {{plan_name}}
- **Charged:** \${{amount}} {{currency}}
- **Payment Method:** {{payment_method}}
- **Coverage Extended Until:** {{next_renewal_date}}

Access your updated receipt and manage your settings here: **[Billing Center]({{billing_portal_url}})**.

Thank you for your ongoing partnership.

{{app_name}} Customer Success`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 11:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "next_renewal_date", "billing_portal_url"],
  },
  {
    id: "mail_renewal_zh",
    code: "RENEWAL_CONFIRM_ZH",
    name: "订阅周期自动续费凭证 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "LIFECYCLE",
    description: "周期订阅扣款成功时，向用户下发自动续订确认与新周期权益说明",
    triggerEvent: "invoice.paid",
    subject: "【自动续期凭证】您的 {{app_name}} 会员已成功自动续约",
    senderName: "NovasPay 订阅中心",
    senderEmail: "subscriptions@novaspay.global",
    previewText: "您订阅的周期方案已完成自动扣划，您的全部权益已顺延至下一计费周期。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

特此通知，您的 **{{app_name}}** 会员订阅已按照周期协议完成自动续约扣款。

- **续费方案：** {{plan_name}}
- **扣划金额：** {{currency}} {{amount}}
- **支付卡别：** {{payment_method}}
- **新计费期截止：** {{next_renewal_date}}

您可登录 **[客户账户中心]({{billing_portal_url}})** 查看电子账单归档或变更续费计划。

感谢您一如既往的支持！  
{{app_name}} 团队`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 11:10:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "next_renewal_date", "billing_portal_url"],
  },
  {
    id: "mail_renewal_es",
    code: "RENEWAL_CONFIRM_ES",
    name: "Renovación de Suscripción Confirmada (Español)",
    language: "es-ES",
    languageLabel: "Español (es-ES)",
    category: "LIFECYCLE",
    description: "Notificación de renovación automática periódica en español",
    triggerEvent: "invoice.paid",
    subject: "Tu suscripción a {{app_name}} se ha renovado con éxito",
    senderName: "NovasPay Suscripciones",
    senderEmail: "suscripciones-es@novaspay.global",
    previewText: "Hemos procesado tu renovación periódica para {{plan_name}}.",
    contentMarkdown: `### Hola {{customer_name}},

Confirmamos que tu suscripción a **{{app_name}}** se ha renovado automáticamente.

- **Plan:** {{plan_name}}
- **Importe:** {{amount}} {{currency}}
- **Método de pago:** {{payment_method}}
- **Válido hasta:** {{next_renewal_date}}

Accede a tu recibo y gestiona tu cuenta en el **[Portal de Facturación]({{billing_portal_url}})**.

Atentamente,  
El equipo de {{app_name}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 11:20:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "next_renewal_date", "billing_portal_url"],
  },
  {
    id: "mail_dunning_en",
    code: "DUNNING_FAIL_EN",
    name: "信用卡续费失败催付预警 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "BILLING",
    description: "扣款失败（余额不足/卡过期/3DS拒绝）时，自动触发催付与更新信用卡指引",
    triggerEvent: "invoice.payment_failed",
    subject: "Action Required: Payment failed for your {{app_name}} subscription",
    senderName: "NovasPay Billing Alert",
    senderEmail: "billing-alerts@novaspay.global",
    previewText: "We couldn't process your renewal payment. Please update your card to avoid service interruption.",
    contentMarkdown: `### Hi {{customer_name}},

We attempted to process your scheduled subscription payment for **{{app_name}}**, but your card was declined by your bank.

#### ⚠️ Payment Attempt Summary
- **Plan:** {{plan_name}}
- **Amount Due:** \${{amount}} {{currency}}
- **Card Attempted:** {{payment_method}}
- **Reason:** Insufficient funds or card restriction (Code: do_not_honor)

#### Next Steps to Keep Your Service Active:
Please visit your **[Secure Billing Portal]({{billing_portal_url}})** to update your payment method or retry the charge. We will automatically retry in 3 business days.

Thank you for your prompt attention.

The {{app_name}} Team`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 12:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "billing_portal_url"],
  },
  {
    id: "mail_dunning_zh",
    code: "DUNNING_FAIL_ZH",
    name: "信用卡续费失败催付预警 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "BILLING",
    description: "扣款失败（余额不足/卡过期/3DS拒绝）时，自动触发催付与更新信用卡指引",
    triggerEvent: "invoice.payment_failed",
    subject: "【重要提醒】您的 {{app_name}} 订阅续费扣款未成功，请及时更新支付卡",
    senderName: "NovasPay 扣费预警中心",
    senderEmail: "billing-alerts@novaspay.global",
    previewText: "我们尝试扣缴您的订阅续费未能成功，请尽快更新信用卡以防止会员服务中断。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

系统在对您的 **{{app_name}}** 周期会员进行续费自动扣款时，发卡行未能授权本次扣划。

#### ⚠️ 失败交易详情
- **待续订套餐：** {{plan_name}}
- **应付金额：** {{currency}} {{amount}}
- **扣款卡号：** {{payment_method}}
- **发卡行拒绝原因：** 额度不足或海外交易受限 (Code: do_not_honor)

#### 如何恢复您的权益：
请登录 **[安全账务中心]({{billing_portal_url}})** 绑定新卡或重新授权扣划。系统将在 3 个工作日后执行二次自动重试。若逾期未付款，您的会员权益可能被暂时冻结。

如有疑问，欢迎随时回复本邮件。

{{app_name}} 财务技术团队`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 12:15:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "payment_method", "billing_portal_url"],
  },
  {
    id: "mail_dunning_de",
    code: "DUNNING_FAIL_DE",
    name: "Verlängerungszahlung fehlgeschlagen (Deutsch)",
    language: "de-DE",
    languageLabel: "Deutsch (de-DE)",
    category: "BILLING",
    description: "Dunning-Mahnung für abgelehnte Kreditkartenabbuchungen",
    triggerEvent: "invoice.payment_failed",
    subject: "Handlungsbedarf: Verlängerungszahlung für {{app_name}} fehlgeschlagen",
    senderName: "NovasPay Zahlungsdienst",
    senderEmail: "billing-de@novaspay.global",
    previewText: "Ihre Zahlung konnte nicht durchgeführt werden. Bitte aktualisieren Sie Ihre Zahlungsart.",
    contentMarkdown: `### Hallo {{customer_name}},

Ihre letzte Verlängerungszahlung für **{{app_name}}** in Höhe von {{amount}} {{currency}} konnte von Ihrer Bank leider nicht autorisiert werden.

Bitte aktualisieren Sie Ihre Zahlungsdaten im **[Kunden-Portal]({{billing_portal_url}})**, um eine Unterbrechung Ihrer Dienste zu vermeiden.

Mit freundlichen Grüßen  
{{app_name}} Team`,
    status: "ACTIVE",
    updatedAt: "2026-09-04 12:30:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "amount", "currency", "billing_portal_url"],
  },
  {
    id: "mail_cancel_en",
    code: "SUB_CANCELED_EN",
    name: "订阅退订确认与权益保留 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "LIFECYCLE",
    description: "用户在个人中心主动取消连续订阅时下发的确认邮件，明确权益截止日期",
    triggerEvent: "customer.subscription.deleted",
    subject: "Subscription Cancellation Confirmed - {{app_name}}",
    senderName: "NovasPay Customer Care",
    senderEmail: "support@novaspay.global",
    previewText: "We're sorry to see you go. Your benefits remain active until the end of your billing cycle.",
    contentMarkdown: `### Hi {{customer_name}},

We're confirming that your subscription to **{{app_name}}** has been canceled as requested.

#### ℹ️ What happens next?
- **Current Access:** Your benefits remain completely active until **{{active_until_date}}**.
- **Future Charges:** No further automatic charges will occur on your payment method.
- **Data Retention:** Your workspace data and projects will be safely preserved in read-only mode for 90 days.

If you ever change your mind, you can re-activate your subscription anytime with a single click in your **[Account Settings]({{billing_portal_url}})**.

We'd love to hear your feedback on how we can improve.

Warm regards,  
The {{app_name}} Support Team`,
    status: "ACTIVE",
    updatedAt: "2026-09-03 14:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "active_until_date", "billing_portal_url"],
  },
  {
    id: "mail_cancel_zh",
    code: "SUB_CANCELED_ZH",
    name: "订阅退订确认与权益保留 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "LIFECYCLE",
    description: "用户在个人中心主动取消连续订阅时下发的确认邮件，明确权益截止日期",
    triggerEvent: "customer.subscription.deleted",
    subject: "【退订确认】您的 {{app_name}} 订阅已取消，权益保留至 {{active_until_date}}",
    senderName: "NovasPay 客户服务部",
    senderEmail: "support@novaspay.global",
    previewText: "我们已收到您的退订申请。在当前账期截止前，您仍可正常使用全部功能。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

我们已收到您主动取消 **{{app_name}}** 连续订阅的申请，特此发送确认邮件。

#### ℹ️ 重要须知与后续说明
- **权益有效期：** 您的所有 VIP 会员权益将一直持续保留至 **{{active_until_date}}**。
- **扣费终止：** 自即日起，系统将永久停止从您的支付方式中发起下期自动代扣。
- **数据保留：** 您的项目数据、历史账单与账务记录将至少保留 180 天。

如果您后续有重新开通的需求，随时可以通过 **[用户后台]({{billing_portal_url}})** 一键恢复订阅。

期待未来再次为您服务！  
{{app_name}} 客户服务部`,
    status: "ACTIVE",
    updatedAt: "2026-09-03 14:15:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "active_until_date", "billing_portal_url"],
  },
  {
    id: "mail_cancel_ja",
    code: "SUB_CANCELED_JA",
    name: "サブスクリプション解約完了のご案内 (日本語)",
    language: "ja-JP",
    languageLabel: "日本語 (ja-JP)",
    category: "LIFECYCLE",
    description: "定期購入の自動更新解約完了通知と特典有効期限のご案内",
    triggerEvent: "customer.subscription.deleted",
    subject: "【解約完了】{{app_name}} サブスクリプション解約手続き完了のお知らせ",
    senderName: "NovasPay サポートデスク",
    senderEmail: "support-jp@novaspay.global",
    previewText: "解約手続きを完了いたしました。{{active_until_date}} までは現在の特典を引き続きご利用いただけます。",
    contentMarkdown: `### {{customer_name}} 様

いつも **{{app_name}}** をご利用いただきありがとうございます。  
お客様よりご申請いただきました定期購読の解約手続きが完了いたしました。

#### ℹ️ 今後のご利用とお支払いについて
- **機能のご利用：** **{{active_until_date}}** までは現在のプラン特典をそのままご利用いただけます。
- **次回以降の請求：** 以降の自動引き落としは発生いたしません。

サービスについてお気づきの点やご要望がございましたら、いつでもご意見をお聞かせいただけますと幸いです。

{{dict.support.contact_247}}

{{app_name}} サポートチーム`,
    status: "ACTIVE",
    updatedAt: "2026-09-03 14:30:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "active_until_date"],
    dictReferences: ["support.contact_247"],
  },
  {
    id: "mail_security_en",
    code: "SECURITY_RESET_EN",
    name: "密码安全重置与两步验证 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "SECURITY",
    description: "用户申请重置密码时发送的单次高安全数字验证码",
    triggerEvent: "account.password_reset",
    subject: "Reset your {{app_name}} account password (Verification Code: {{security_code}})",
    senderName: "NovasPay Security Team",
    senderEmail: "security@novaspay.global",
    previewText: "Your one-time verification code is {{security_code}}. It expires in 15 minutes.",
    contentMarkdown: `### Hi {{customer_name}},

We received a request to reset the login password for your **{{app_name}}** account.

#### 🛡️ Your One-Time Security Code:
# \`{{security_code}}\`

*This code will expire in **15 minutes**. For security reasons, never share this code with anyone.*

If you did not request this password reset, please ignore this email or notify our security team immediately at **security@novaspay.global**.

Stay safe,  
The {{app_name}} Security Operations Center`,
    status: "ACTIVE",
    updatedAt: "2026-09-02 16:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "security_code"],
  },
  {
    id: "mail_security_zh",
    code: "SECURITY_RESET_ZH",
    name: "密码安全重置与两步验证 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "SECURITY",
    description: "用户申请重置密码时发送的单次高安全数字验证码",
    triggerEvent: "account.password_reset",
    subject: "【NovasPay 安全中心】重置您的 {{app_name}} 密码（验证码: {{security_code}}）",
    senderName: "NovasPay 安全中心",
    senderEmail: "security@novaspay.global",
    previewText: "您的一次性安全验证码为 {{security_code}}，15分钟内有效，切勿泄露给他人。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

我们收到了针对您 **{{app_name}}** 账户的密码重置申请。

#### 🛡️ 您的单次安全验证码：
# \`{{security_code}}\`

*该验证码将在 **15 分钟** 后失效。工作人员绝不会向您索取此验证码，请勿告知他人。*

如果您并未发起此申请，请忽略此邮件，您的账户依然安全；或立即联络我们的风控合规团队 **security@novaspay.global**。

{{app_name}} 国际风控合规部`,
    status: "ACTIVE",
    updatedAt: "2026-09-02 16:15:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "security_code"],
  },
  {
    id: "mail_security_fr",
    code: "SECURITY_RESET_FR",
    name: "Réinitialisation du Mot de Passe (Français)",
    language: "fr-FR",
    languageLabel: "Français (fr-FR)",
    category: "SECURITY",
    description: "Code de vérification sécurisé pour réinitialiser le mot de passe",
    triggerEvent: "account.password_reset",
    subject: "Réinitialisation de votre mot de passe {{app_name}} (Code: {{security_code}})",
    senderName: "NovasPay Sécurité",
    senderEmail: "security-fr@novaspay.global",
    previewText: "Votre code de sécurité à usage unique est {{security_code}}. Valable 15 minutes.",
    contentMarkdown: `### Bonjour {{customer_name}},

Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte **{{app_name}}**.

#### 🛡️ Votre code de sécurité :
# \`{{security_code}}\`

*Ce code expire dans **15 minutes**. Ne le partagez jamais avec des tiers.*

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.

L'équipe Sécurité {{app_name}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-02 16:30:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "security_code"],
  },
  {
    id: "mail_promo_en",
    code: "PROMO_DISCOUNT_EN",
    name: "出海专属立减折扣优惠券 (English)",
    language: "en-US",
    languageLabel: "English (US)",
    category: "PROMOTION",
    description: "针对特定出海客户派发的限时专属早鸟折扣优惠码",
    triggerEvent: "campaign.scheduled_send",
    subject: "🔥 Exclusive {{discount_rate}}% Off: Boost your growth with {{app_name}}!",
    senderName: "NovasPay Special Offers",
    senderEmail: "perks@novaspay.global",
    previewText: "Use coupon code {{coupon_code}} to get an instant discount on your next plan upgrade.",
    contentMarkdown: `### Hi {{customer_name}},

We're excited to offer you a limited-time privilege to supercharge your business expansion!

#### 🎁 Your VIP Promo Code:
# \`{{coupon_code}}\`

- **Discount:** **{{discount_rate}}% Instant Savings**
- **Eligible Plans:** All Enterprise & Professional Annual Tiers
- **Expiration Date:** {{expiry_date}}

Click the link below to apply your discount automatically at checkout:
**[Claim My {{discount_rate}}% Discount Now →]({{checkout_discount_url}})**

Happy building,  
The {{app_name}} Growth Team

---
{{dict.email.footer.unsubscribe}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-01 15:00:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "discount_rate", "coupon_code", "expiry_date", "checkout_discount_url"],
    dictReferences: ["email.footer.unsubscribe"],
  },
  {
    id: "mail_promo_zh",
    code: "PROMO_DISCOUNT_ZH",
    name: "出海专属立减折扣优惠券 (简体中文)",
    language: "zh-CN",
    languageLabel: "简体中文 (zh-CN)",
    category: "PROMOTION",
    description: "针对特定出海客户派发的限时专属早鸟折扣优惠码",
    triggerEvent: "campaign.scheduled_send",
    subject: "🔥 专属礼遇：送您 {{discount_rate}}% 优惠券，升级 {{app_name}} 畅享全球收单！",
    senderName: "NovasPay 专属特惠",
    senderEmail: "perks@novaspay.global",
    previewText: "使用专属优惠码 {{coupon_code}} 立即享受立减抵扣，限时开放。",
    contentMarkdown: `### 尊敬的 {{customer_name}}：

感谢您关注并使用 **{{app_name}}**！为了助力您的海外业务快速起量，我们特为您发放了一张高额专属折扣券：

#### 🎁 您的专属折扣优惠码：
# \`{{coupon_code}}\`

- **优惠力度：** **立享 {{discount_rate}}% 折扣减免**
- **适用范围：** 所有商业版及旗舰版年度方案
- **有效截止：** {{expiry_date}}

点击下方专属通道直接抵扣下单：  
**[立即领取并结算抵扣 →]({{checkout_discount_url}})**

祝您海外业务蓬勃发展！  
{{app_name}} 增长运营团队

---
{{dict.email.footer.unsubscribe}}`,
    status: "ACTIVE",
    updatedAt: "2026-09-01 15:15:00",
    associatedTenantId: "ALL",
    variables: ["customer_name", "app_name", "discount_rate", "coupon_code", "expiry_date", "checkout_discount_url"],
    dictReferences: ["email.footer.unsubscribe"],
  },
];
