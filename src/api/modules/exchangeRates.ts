import { http } from "../request";
import type { ExchangeRate } from "../../types/payment";

export async function listExchangeRates(): Promise<ExchangeRate[]> {
  return http.get<ExchangeRate[]>("/exchange-rates");
}

export async function saveExchangeRate(payload: ExchangeRate): Promise<ExchangeRate> {
  if (payload.id) {
    return http.put<ExchangeRate>(`/exchange-rates/${payload.id}`, payload);
  }
  return http.post<ExchangeRate>("/exchange-rates", payload);
}

export async function deleteExchangeRate(id: string): Promise<void> {
  await http.delete(`/exchange-rates/${id}`);
}

export type RateHistoryPoint = { rate: number; recordedAt: string };

export async function getExchangeRateHistory(id: string): Promise<RateHistoryPoint[]> {
  return http.get<RateHistoryPoint[]>(`/exchange-rates/${id}/history`);
}
