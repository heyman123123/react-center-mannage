/**
 * 支付渠道选项：来自字典分类 PAYMENT_CHANNEL 词条。
 * entryKey = 渠道码；展示名优先 translations["zh-CN"]。
 */
import { listDictionaryCategories, listDictionaryEntries } from "../api/modules/iam";

export type PaymentChannelOption = { value: string; label: string };

const CATEGORY_KEYS = ["PAYMENT_CHANNEL", "payment_channel"];

export async function loadPaymentChannelOptions(): Promise<PaymentChannelOption[]> {
  try {
    const cats = await listDictionaryCategories();
    const flat: { id: string; key: string; children?: unknown[] }[] = [];
    const walk = (nodes: Array<{ id: string; key: string; children?: typeof nodes }>) => {
      for (const n of nodes || []) {
        flat.push(n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(cats as Array<{ id: string; key: string; children?: typeof cats }>);

    const cat = flat.find((c) => CATEGORY_KEYS.includes(c.key));
    if (!cat) return [];

    const page = await listDictionaryEntries({
      categoryId: cat.id,
      page: 1,
      pageSize: 100,
    });
    return (page.list || [])
      .map((e) => {
        const value = (e.entryKey || e.key || "").trim();
        if (!value) return null;
        const label =
          e.translations?.["zh-CN"] ||
          e.label ||
          e.translations?.["en-US"] ||
          value;
        return { value, label };
      })
      .filter((x): x is PaymentChannelOption => !!x)
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  } catch {
    return [];
  }
}
