# Shell 实用基础

本页只讲后续 Linux 实验需要的 Bash 能力。示例基线是 Ubuntu 24.04 LTS 的 Bash；`sh`、其他 Shell 和不同版本可能有不同语义。命令会改变状态时，先验证目标，再只清理本实验创建的资源。

## 实验环境与安全目录

不要在系统目录或已有项目中练习删除操作。使用 `mktemp` 创建唯一目录，并让变量始终被双引号保护：

```bash
set -u
lab_dir=$(mktemp -d --tmpdir linux-shell-lab.XXXXXX)
test -d "$lab_dir"
printf 'lab_dir=%s\n' "$lab_dir"
```

`mktemp` 成功后打印的路径是本流程的唯一写入范围。`set -u` 会让未定义变量成为错误，但它不能验证变量指向的路径是否安全。

## 路径、工作目录与 PATH

working directory（工作目录）决定相对路径从哪里解析；`PATH` 决定只写命令名时 Shell 到哪些目录查找可执行文件。

```bash
pwd
printf 'PATH=%s\n' "$PATH"
command -v bash
realpath "$lab_dir"
```

`command -v` 说明当前 Shell 会选择什么，不证明该文件在未来或另一个用户环境中仍相同。脚本涉及重要工具时应检查命令存在，systemd unit 则优先使用绝对 `ExecStart` 路径。

## 引用、变量与参数

引用决定字符何时保持原义、何时发生展开。双引号允许 `$variable` 与命令替换展开，同时避免空格和 glob 再次拆分；单引号保留其中字符原义。

```bash
name='demo api'
printf 'quoted=%s\n' "$name"
printf 'literal=%s\n' '$name'
```

除非明确需要 word splitting 或 glob，否则使用 `"$variable"`。不要把不可信文本拼接后交给 `eval`；那会重新解释其中的 Shell 语法。

## 标准输入、输出与错误

每个进程通常从文件描述符 `0` 读取 stdin，向 `1` 写 stdout，向 `2` 写 stderr。重定向由 Shell 在创建命令时配置：

```bash
stdout_file="$lab_dir/stdout.log"
stderr_file="$lab_dir/stderr.log"
{
  printf 'normal output\n'
  printf 'diagnostic output\n' >&2
} >"$stdout_file" 2>"$stderr_file"
wc -l "$stdout_file" "$stderr_file"
```

stdout 和 stderr 是传输通道，不等于日志级别。`2>&1` 的位置会影响它复制哪个文件描述符，不能随意换序。

## 管道与退出状态

pipeline 把前一个命令的 stdout 连接到后一个命令的 stdin。pipeline 的默认退出状态通常来自最后一个命令，因此前序失败可能被隐藏。

```bash
set +o pipefail
false | sed -n '1p'
default_status=$?

set -o pipefail
false | sed -n '1p'
pipefail_status=$?

printf 'default=%s pipefail=%s\n' "$default_status" "$pipefail_status"
```

`$?` 只保存最近一个 pipeline 的退出状态，读取前要立即赋值。`pipefail` 让失败更可见，但不能告诉你业务结果是否正确。

## 条件执行与函数

在预期可能失败的判断中显式使用 `if`，比依赖全局退出规则更清楚：

```bash
require_command() {
  command -v "$1" >/dev/null 2>&1
}

if require_command ss; then
  printf 'ss is available\n'
else
  printf 'missing ss; install the Ubuntu iproute2 package\n' >&2
  exit 1
fi
```

函数的参数使用 `$1`、`$2` 等位置参数；引用 `"$@"` 才能保持每个原始参数的边界。

## trap 与精确清理

trap 只清理本脚本创建且已经验证身份的资源。清理函数先检查变量非空、目录是预期前缀且确实存在：

```bash
cleanup() {
  case "${lab_dir:-}" in
    /tmp/linux-shell-lab.*)
      if test -d "$lab_dir"; then
        rm -r -- "$lab_dir"
      fi
      ;;
    *)
      printf 'refusing unexpected cleanup target: %s\n' "${lab_dir:-<unset>}" >&2
      return 1
      ;;
  esac
}

trap cleanup EXIT HUP INT TERM
test -d "$lab_dir"
```

这里不用宽泛的 `rm -rf`。如果目录不存在，流程应查明状态，而不是用 `-f` 隐藏错误。

## strict mode 的边界

常见开头 `set -euo pipefail` 能发现部分错误，但不是事务系统：

- `set -e` 在条件、逻辑列表、pipeline 和命令替换等上下文有细致规则；set -e 不能代替显式错误处理。
- `set -u` 能发现未定义变量，但 `${optional:-}` 仍需用于有意可选的值。
- `pipefail` 改变 pipeline 状态，但不会自动打印失败命令的业务原因。
- 即使脚本提前退出，外部动作也未必自动回滚；必须设计幂等或精确清理。

用于后续实验的安全骨架是：

```bash
#!/usr/bin/env bash
set -euo pipefail

lab_dir=$(mktemp -d --tmpdir demo-api-lab.XXXXXX)

cleanup() {
  case "$lab_dir" in
    /tmp/demo-api-lab.*) test ! -d "$lab_dir" || rm -r -- "$lab_dir" ;;
    *) return 1 ;;
  esac
}

trap cleanup EXIT HUP INT TERM
printf 'work safely inside %s\n' "$lab_dir"
```

## 失败检查点

| 症状 | 先检查 | 边界 |
| --- | --- | --- |
| 命令找不到 | `command -v name` 与 `PATH` | 不要下载未知同名二进制绕过包管理 |
| 路径含空格后失败 | 变量是否双引号保护 | 引用错误可能把一个路径拆成多个参数 |
| pipeline 看似成功 | 保存 `$?`，按需启用 `pipefail` | 状态为零仍不证明输出内容正确 |
| 清理目标异常 | 打印并验证绝对路径和前缀 | 拒绝执行比猜测目标安全 |

Shell 语义可参考 [Bash manual](https://www.gnu.org/software/bash/manual/bash.html)；进程和 Shell 接口的 Linux 边界见 [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html)。

## 下一步

继续[在主机运行 demo-api](/linux/guide/run-demo-api)，把变量、重定向、PID、退出状态和精确清理用于同一个可观察进程。之后用[进程与 procfs](/linux/concepts/processes-and-procfs)解释这些证据来自哪里。
