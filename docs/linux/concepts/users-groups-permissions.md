# 用户、组与权限

Linux kernel 在访问检查中使用进程凭据和文件元数据。用户名只是用户空间把数值身份映射成人类可读文本的方式；kernel 比较数值 UID 和 GID，不比较用户名字符串。

## 身份是数值

进程具有 real、effective、saved 和 filesystem UID/GID 等凭据。日常检查先看当前身份、组和名称服务映射：

```bash
id
getent passwd "$(id -u)"
getent group "$(id -g)"
```

相同用户名在不同主机可能对应不同 UID。移动文件、bind mount 或共享卷时，真正影响 ownership 的是数值 UID/GID。

## 主组与附加组

进程有一个 effective GID，并可以拥有 supplementary groups（附加组）。新增组成员关系后，已有登录会话不会自动获得新凭据，通常需要新的登录会话或由服务管理者重新创建进程。

```bash
id -u
id -g
id -G
id -Gn
```

不要用“用户在某组里”直接证明目标进程已经携带该组；应检查目标进程的 `/proc/<pid>/status` 中 `Groups` 字段。

## 文件与目录 mode

mode bits 分为 owner、group、other 的 read、write、execute。对普通文件，execute 表示可执行；目录的 execute 位控制路径遍历，而 read 位控制列出目录项。能读取最终文件仍要求路径每一级目录可遍历。

```bash
namei -l /opt/demo-api/server.mjs
stat --format='mode=%A uid=%u gid=%g path=%n' /opt /opt/demo-api
```

`chmod 777` 会把写权限开放给所有本地用户，不能作为权限故障的常规修复。应定位具体路径层级和需要的最小访问。

## umask

创建程序请求一个 mode，umask 从请求的 mode 中移除权限。它不会给已有文件追加权限，也不等于简单的十进制减法。

```bash
current_umask=$(umask)
printf 'umask=%s\n' "$current_umask"
lab_dir=$(mktemp -d --tmpdir permission-lab.XXXXXX)
(
  umask 0027
  : >"$lab_dir/example"
  stat --format='%A %a %n' "$lab_dir/example"
)
rm -r -- "$lab_dir"
```

预期文件不会获得 group/other write，other 权限被移除。实际初始 mode 还由创建程序决定。

## ownership 与 ACL

`chown` 改变数值 owner/group；ACL 可以在传统 mode bits 之外给特定主体授权，但 ACL mask 会限制 named user/group 的有效权限。

```bash
stat --format='uid=%u gid=%g mode=%a path=%n' /opt/demo-api
getfacl --absolute-names /opt/demo-api 2>/dev/null || true
```

Ubuntu 最小环境可能未安装 `acl` 包。不要为了隐藏设计不清的 ownership 而叠加复杂 ACL；先确定服务账户真正需要读取和写入的路径。

## capabilities

capability 把传统 root 权限拆成独立能力，例如 `CAP_NET_BIND_SERVICE`。它缩小授权粒度，但 capability 本身仍是高影响权限，需要说明威胁边界。

```bash
capsh --print 2>/dev/null | sed -n '1,12p' || true
getcap -r /opt/demo-api 2>/dev/null || true
```

`demo-api` 使用非特权端口 3000，不需要为 Node.js 二进制设置 file capability。不要为了绑定低端口而给通用运行时永久添加能力；更合适的前置代理或 systemd socket 方案应在网络设计中评估。

## 创建服务账户

后续 systemd 实验需要专用 `demo-api` 系统账户。前置条件是 Ubuntu 24.04 测试主机、当前操作者获准使用 `sudo`，并确认没有现有同名业务账户。

```bash
if getent passwd demo-api >/dev/null; then
  printf 'demo-api already exists; inspect it instead of overwriting\n' >&2
  exit 1
fi

sudo useradd --system \
  --home-dir /var/lib/demo-api \
  --create-home \
  --shell /usr/sbin/nologin \
  --user-group \
  demo-api

getent passwd demo-api
getent group demo-api
```

成功证据是 passwd entry 的 home 为 `/var/lib/demo-api`、shell 为 `/usr/sbin/nologin`，UID 位于当前系统账户策略范围。`nologin` 阻止普通交互登录，不阻止 systemd 以该 UID 创建服务进程。

## demo-api 目录

应用代码由 root 部署、服务账户只读；状态目录由服务账户写入：

```bash
sudo install -d -o root -g demo-api -m 0750 /opt/demo-api
sudo install -d -o demo-api -g demo-api -m 0750 /var/lib/demo-api
sudo install -o root -g demo-api -m 0640 server.mjs /opt/demo-api/server.mjs

namei -l /opt/demo-api/server.mjs
sudo -u demo-api test -r /opt/demo-api/server.mjs
sudo -u demo-api test -w /var/lib/demo-api
```

Node.js 运行时也应部署为 root-owned、服务账户可读取和执行。应用账户不应能改写自己的可执行代码，否则应用漏洞可转化为持久化。

## 精确清理

只有在 `demo-api.service` 不存在或已停用、账户属性仍与实验一致、目录中没有非实验数据时才清理：

```bash
if systemctl is-active --quiet demo-api.service; then
  printf 'refusing account cleanup while demo-api.service is active\n' >&2
  exit 1
fi

passwd_entry=$(getent passwd demo-api)
expected_suffix=':/var/lib/demo-api:/usr/sbin/nologin'
case "$passwd_entry" in
  *"$expected_suffix") ;;
  *) printf 'refusing cleanup: account attributes differ\n' >&2; exit 1 ;;
esac

sudo test ! -e /opt/demo-api/server.mjs || \
  printf 'remove verified experiment application files before the account\n' >&2
```

不要自动执行 `userdel --remove`：`/var/lib/demo-api` 可能已包含需要保留的状态。清理顺序和具体删除将在 [systemd 服务](/linux/runtime/systemd-services)完成后给出。

## 边界与误区

- 非 root 账户能缩小权限，但共享 kernel、可读 secret、开放 socket 和错误 capability 仍可能造成风险。
- 文件名显示的用户取决于本机名称服务；用 `stat %u:%g` 验证数值身份。
- root 通常可以绕过很多 DAC 检查，不能用 root 测试代替服务账户测试。
- Kubernetes `runAsUser`、容器镜像 `USER` 和主机服务账户都涉及 UID，但配置与 namespace 边界不同。

参考 [credentials(7)](https://man7.org/linux/man-pages/man7/credentials.7.html)、[path_resolution(7)](https://man7.org/linux/man-pages/man7/path_resolution.7.html) 与 [Ubuntu user management](https://documentation.ubuntu.com/server/how-to/security/user-management/)。继续阅读[文件系统与 mount](/linux/concepts/filesystems-and-mounts)和[安全边界](/linux/operations/security-boundaries)。
