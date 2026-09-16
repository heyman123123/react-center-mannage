package apperr

import "fmt"

type Error struct {
	Code    int
	Message string
	HTTP    int
	Err     error
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func New(code, httpStatus int, message string) *Error {
	return &Error{Code: code, HTTP: httpStatus, Message: message}
}

func Wrap(code, httpStatus int, message string, err error) *Error {
	return &Error{Code: code, HTTP: httpStatus, Message: message, Err: err}
}

var (
	Unauthorized      = New(40100, 401, "未登录或会话已失效")
	Forbidden         = New(40300, 403, "无权限")
	NotFound          = New(40400, 404, "资源不存在")
	Conflict          = New(40900, 409, "资源冲突")
	InvalidArgument   = New(42200, 422, "参数错误")
	InvalidAppEnv     = New(40001, 400, "非法的 X-App-Env")
	InvalidCredential = New(40101, 401, "邮箱或密码错误")
	EmailExists       = New(40901, 409, "邮箱已注册")
	ExecutorDisabled     = New(50100, 200, "定时任务执行器未启用")
	ProviderNotSupported = New(42210, 422, "该邮件服务商暂未接入")
	SendFailed           = New(50210, 502, "邮件发送失败")
)
