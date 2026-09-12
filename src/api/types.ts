/**
 * 通用 API 响应类型定义
 */

/** 后端统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number; // 0 表示成功，非 0 为业务错误码
  message: string;
  data: T;
}

/** 分页结果 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 统一 API 错误类型 */
export class ApiError extends Error {
  code: number;
  status?: number;

  constructor(message: string, code: number = -1, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
