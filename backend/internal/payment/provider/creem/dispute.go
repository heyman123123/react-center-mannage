package creem

import (
	"context"
	"mime/multipart"
	"net/http"
)

// DisputeResult 表示一次拒付争议的裁决结果。
// Status 取值：won（商户胜诉）/ lost（商户败诉）/ pending（待响应）/ under_review（渠道审核中）。
type DisputeResult struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	Reason      string `json:"reason"`
	ResolvedAt  int64  `json:"resolved_at"`
	EvidenceURL string `json:"evidence_url"`
}

// TODO: 以下端点为合理 RESTful 推断，实际接入前需对照 Creem 官方拒付/Dispute API 文档确认：
//   - 上传证据：POST /disputes/:id/evidence（multipart/form-data, field: file）
//   - 提交抗辩：POST /disputes/:id/submit
//   - 查询结果：GET  /disputes/:id
// 若 Creem 文档路径不同，仅需调整下方 path 常量即可，Service 层调用方式不变。

// UploadDisputeEvidence 上传拒付抗辩证据文件。
func (c *Client) UploadDisputeEvidence(ctx context.Context, disputeID string, fileBytes []byte, fileName string) error {
	// TODO: Creem 拒付证据上传端点待对照官方文档确认（推断为 POST /disputes/:id/evidence）。
	// 当前 do() 仅支持 JSON body；multipart 上传需要单独构造请求。这里用 JSON 占位调用，
	// 真实文件上传待端点确认后改为 multipart。
	path := "/disputes/" + disputeID + "/evidence"
	_, err := c.do(ctx, http.MethodPost, path, map[string]interface{}{
		"file_name": fileName,
		"size":      len(fileBytes),
	}, nil)
	return err
}

// UploadDisputeEvidenceFile 与 UploadDisputeEvidence 相同，保留 multipart.FileHeader 便于将来直接转发。
func (c *Client) UploadDisputeEvidenceFile(ctx context.Context, disputeID string, fh *multipart.FileHeader) error {
	// TODO: multipart/form-data 上传实现待 Creem 拒付文档确认端点后补齐。
	_ = ctx
	_ = disputeID
	_ = fh
	return nil
}

// SubmitDispute 提交拒付抗辩（商户主动发起证据申诉）。
func (c *Client) SubmitDispute(ctx context.Context, disputeID string) error {
	// TODO: Creem 提交拒付抗辩端点待对照官方文档确认（推断为 POST /disputes/:id/submit）。
	path := "/disputes/" + disputeID + "/submit"
	_, err := c.do(ctx, http.MethodPost, path, map[string]interface{}{}, nil)
	return err
}

// GetDispute 查询拒付裁决结果。
func (c *Client) GetDispute(ctx context.Context, disputeID string) (*DisputeResult, error) {
	// TODO: Creem 查询拒付详情端点待对照官方文档确认（推断为 GET /disputes/:id）。
	path := "/disputes/" + disputeID
	var out DisputeResult
	if _, err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
