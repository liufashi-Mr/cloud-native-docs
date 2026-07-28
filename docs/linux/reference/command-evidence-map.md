# 命令与证据速查

命令输出是某个时间点的证据，不是自动成立的根因。先使用最小权限读取证据，再决定是否需要 sudo；权限拒绝本身也是边界信息。每条命令都链接回解释其模型的页面。

修改状态的命令不属于只读速查。启动、停止、改权限、写 unit、设置 cgroup 和清理资源应回到对应指导页，确认目标、风险、成功证据和回滚。

## 上下文

```bash
date --iso-8601=seconds
hostnamectl --static
uname -srmo
. /etc/os-release
printf '%s %s\n' "$ID" "$VERSION_ID"
```

用途：对齐时间、主机、kernel 和发行版。不能证明应用状态。见 [Linux 总览](/linux/)。

## 进程与 procfs

```bash
ps -o pid,ppid,user,stat,lstart,etimes,comm -p "$demo_pid"
readlink "/proc/$demo_pid/exe"
tr '\0' ' ' <"/proc/$demo_pid/cmdline"
sed -n -E '/^(State|Pid|PPid|Threads|VmRSS):/p' "/proc/$demo_pid/status"
ls -l "/proc/$demo_pid/fd" | sed -n '1,20p'
```

用途：核对 PID、start time、可执行文件、状态、thread、memory 和 fd。命令行可能含敏感数据。见[进程与 procfs](/linux/concepts/processes-and-procfs)。

## 身份与权限

```bash
id
getent passwd demo-api
getent group demo-api
stat --format='%u:%g %a %n' /opt/demo-api/server.mjs
namei -l /opt/demo-api/server.mjs
getfacl --absolute-names /opt/demo-api 2>/dev/null || true
```

用途：观察 UID/GID、supplementary group、mode、ACL 和路径遍历。不能单独证明 AppArmor 或 mount 允许访问。见[用户、组与权限](/linux/concepts/users-groups-permissions)。

## 文件与 mount

```bash
stat --format='%i %h %s %F %n' /opt/demo-api/server.mjs
findmnt --target /opt/demo-api/server.mjs
findmnt --target /var/lib/demo-api
df -h -- /var/lib/demo-api
df -i -- /var/lib/demo-api
```

用途：观察 inode、link、mount source/type/options、blocks 和 inode 容量。见[文件系统与 mount](/linux/concepts/filesystems-and-mounts)。

## systemd unit

```bash
systemctl show demo-api.service \
  --property LoadState,ActiveState,SubState,MainPID,Result,ExecMainCode,ExecMainStatus,ControlGroup
systemctl cat demo-api.service
systemctl list-dependencies demo-api.service
```

用途：读取有效 unit、状态、主 PID、result 和 cgroup。不能证明 HTTP 健康。见[systemd 服务](/linux/runtime/systemd-services)。

## journal 与 kernel log

```bash
journalctl --unit demo-api.service --since '-15 min' \
  --output short-iso-precise --no-pager
journalctl --boot 0 --dmesg --since '-30 min' --no-pager
journalctl --disk-usage
```

用途：按 unit、boot 和时间关联消息，并观察 journal 容量。不要在保存证据前 vacuum。见[日志与 journal](/linux/runtime/logs-and-journal)。

## socket、route 与 resolver

```bash
ss -ltnp 'sport = :3000'
curl --fail --show-error --connect-timeout 2 \
  http://127.0.0.1:3000/healthz
ip route get 127.0.0.1
getent ahosts localhost
grep -E '^hosts:' /etc/nsswitch.conf
readlink -f /etc/resolv.conf
```

用途：依次观察 listener、应用响应、route、NSS/resolver。DNS 成功不证明 port 监听。见 [socket 与名称解析](/linux/runtime/sockets-and-name-resolution)。

## namespace

```bash
for namespace_path in /proc/self/ns/*; do
  printf '%s -> %s\n' "$namespace_path" "$(readlink "$namespace_path")"
done
lsns --output NS,TYPE,NPROCS,PID,COMMAND | sed -n '1,30p'
```

用途：比较 namespace 对象。标识不同不自动给出配置差异。见 [Linux namespace](/linux/concepts/namespaces)。

## cgroup 与资源

```bash
control_group=$(systemctl show --property ControlGroup --value demo-api.service)
case "$control_group" in /*) ;; *) exit 1 ;; esac
cgroup_path=$(realpath -m "/sys/fs/cgroup$control_group")
case "$cgroup_path" in /sys/fs/cgroup/*) ;; *) exit 1 ;; esac
cat "$cgroup_path/cpu.stat"
cat "$cgroup_path/memory.current"
cat "$cgroup_path/memory.events"
cat "$cgroup_path/pids.current"
cat "$cgroup_path/pids.max"
```

用途：读取 cgroup path、CPU、memory event 和 PID 统计。记录采样时间和增量。见 [cgroup 与资源](/linux/concepts/cgroups-and-resources)。

## pressure

```bash
uptime
cat /proc/pressure/cpu
cat /proc/pressure/memory
cat /proc/pressure/io
ps -o pid,stat,wchan:24,pcpu,pmem,comm -p "$demo_pid"
```

用途：观察 host load、PSI 与目标进程采样。高利用率、pressure 和 limit event 不可互换。见[资源压力](/linux/runtime/resource-pressure)。

## 只读顺序

1. 记录时间、主机、unit、请求和症状。
2. 看 unit/load、进程 start/exit，再看 identity/path。
3. 看 listener/HTTP，再看 resolver/route。
4. 看 cgroup events、PSI 和 kernel/host。
5. 保存证据后才设计最小变更和回滚。

完整决策树见[系统化排障](/linux/operations/troubleshooting)，安全限制见[安全边界](/linux/operations/security-boundaries)。接口参考 [Linux man-pages](https://man7.org/linux/man-pages/) 与 [systemd manuals](https://www.freedesktop.org/software/systemd/man/latest/)。
