# 日志与 journal

`demo-api` 向 stdout/stderr 写消息，systemd 为服务连接这些流，`systemd-journald` 收集消息并附加可信或用户提供的字段。journal entry 把日志内容与 unit、PID、boot 和时间元数据关联，但仍需要应用上下文才能判断根因。

## 从输出到 entry

主 unit 未覆盖 `StandardOutput`/`StandardError` 时，systemd service 的默认通常把两者送到 journal。stdout 和 stderr 不是日志级别：应用写到 stderr 不自动等于 error priority，写到 stdout 也不自动等于 info。

```bash
systemctl show demo-api.service \
  --property StandardOutput,StandardError,SyslogIdentifier
journalctl --unit demo-api.service --lines 20 --no-pager
```

一条消息可能由 journald 关联 `_SYSTEMD_UNIT`、`_PID`、`_UID`、`_BOOT_ID`、时间戳和 transport。以下划线开头的可信字段通常由 journal 根据消息来源附加，应用不能随意伪造同等语义。

## 按 unit 和时间读取

先记录故障的绝对时间与时区，再收窄 unit 和窗口：

```bash
date --iso-8601=seconds
journalctl --unit demo-api.service \
  --since '10 minutes ago' --until 'now' \
  --output short-iso-precise --no-pager
```

相对时间适合现场快速查看，工单与跨主机关联应保存明确 timestamp、timezone、hostname、boot ID 和 unit。

## 按 boot、PID 与字段关联

```bash
journalctl --list-boots
journalctl --boot 0 --unit demo-api.service --no-pager

main_pid=$(systemctl show --property MainPID --value demo-api.service)
case "$main_pid" in
  ''|0|*[!0-9]*) printf 'service has no running MainPID\n' >&2; exit 1 ;;
esac
journalctl _SYSTEMD_UNIT=demo-api.service _PID="$main_pid" \
  --output verbose --lines 5 --no-pager
```

`_PID` 会受 PID 生命周期影响，旧 PID 可能被复用；同时使用 `_BOOT_ID`、unit 和时间。重启后的新 MainPID 不应拿来过滤重启前 entry。

## priority 与应用语义

journal priority 使用 syslog 0 到 7 级。应用若只写纯文本，journald 不会从单词“error”可靠推导 priority。

```bash
journalctl --unit demo-api.service --priority warning \
  --since '-30 min' --no-pager
journalctl --unit demo-api.service --output json-pretty \
  --lines 1 --no-pager
```

`--priority warning` 包含 warning 及更严重级别，不等于“所有业务错误”。应用需要明确结构化字段、request ID 和错误分类，才能与请求证据关联。

## kernel log 边界

kernel log 记录 kernel 子系统消息，例如设备、filesystem、OOM 和安全模块事件；它不是应用 stdout/stderr。

```bash
journalctl --dmesg --boot 0 --since '-30 min' --no-pager
dmesg --ctime --level=err,warn 2>/dev/null | tail -n 40 || true
```

读取 kernel log 可能受 `dmesg_restrict` 和权限限制。没有权限不是“没有 kernel 事件”；应通过获授权的主机观察渠道查询。不要为方便排障关闭限制。

## 导出与证据保存

在重启、清理或变更前，把限定范围导出到权限受控的临时目录，并记录 checksum：

```bash
evidence_dir=$(mktemp -d --tmpdir demo-api-evidence.XXXXXX)
journalctl --unit demo-api.service --since '-30 min' \
  --output export --no-pager >"$evidence_dir/demo-api.journal-export"
systemctl show demo-api.service >"$evidence_dir/demo-api.systemd-show"
sha256sum "$evidence_dir"/* >"$evidence_dir/SHA256SUMS"
chmod 0700 "$evidence_dir"
chmod 0600 "$evidence_dir"/*
printf 'evidence_dir=%s\n' "$evidence_dir"
```

export 内容可能包含路径、UID、命令行和应用数据。按组织的访问控制、保留期和事件流程处理，不能上传公共位置。

## retention 与磁盘

journald 的 retention（保留）受配置、persistent/volatile storage、空间上限和 vacuum 策略影响。先读取用量与有效配置：

```bash
journalctl --disk-usage
systemd-analyze cat-config systemd/journald.conf | sed -n '1,220p'
findmnt --target /var/log/journal 2>/dev/null || true
```

删除或 vacuum journal 会破坏仍可能需要的排障证据。只有在完成授权、导出、校验和保留评估后，才按容量管理流程操作；本文不执行 vacuum。

## 敏感数据边界

- 不把 secret 放入命令行参数，`_CMDLINE` 等字段可能保存它。
- 普通环境变量也可能被同 UID 进程、诊断工具或 crash 信息观察；避免完整环境转储。
- request body、token 和个人数据不应因“方便排障”默认写入日志。
- 日志访问权限、转发端和保留策略都属于安全边界。

systemd credential 可以降低 secret 直接出现在 unit 文本或普通环境中的风险，但应用仍需从受控文件描述符或路径读取，并避免再次打印。详见[安全边界](/linux/operations/security-boundaries)。

## 失败检查点

| 现象 | 检查 | 边界 |
| --- | --- | --- |
| `journalctl -u` 无输出 | boot、unit 名、时间范围、storage mode | 不代表服务从未运行 |
| 只有启动失败摘要 | `--output verbose` 与更宽时间窗口 | 仍要检查路径、身份和 ExecStart |
| PID 过滤遗漏消息 | unit、boot、重启前后 MainPID | PID 会变化和复用 |
| journal 占用较大 | `--disk-usage` 与有效配置 | 保存证据后再执行容量流程 |

参考 [journalctl](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html)、[systemd.journal-fields](https://www.freedesktop.org/software/systemd/man/latest/systemd.journal-fields.html) 和 [Ubuntu logs documentation](https://documentation.ubuntu.com/server/how-to/observability/)。下一步用[系统化排障](/linux/operations/troubleshooting)把 journal 与进程、权限、socket 和资源证据组合。
