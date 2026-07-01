答题网站一键部署包

使用方法：

1. 确认你的服务器是 Linux，并且可以用 SSH 登录。
2. 确认服务器安全组/防火墙放行 80 端口。
3. 右键 “一键部署到服务器.ps1”，选择“使用 PowerShell 运行”。
4. 按提示输入：
   - 服务器 IP 或域名
   - SSH 用户名，例如 root / ubuntu
   - 网站域名或服务器 IP
   - 固定管理员账号
   - 固定管理员密码
   - AI_API_KEY / AI_API_BASE / AI_MODEL，可留空

脚本会自动完成：

- 打包当前本机项目
- 上传到服务器 /opt/quiz-site
- 安装 Python 依赖
- 安装 Gunicorn
- 配置 systemd 常驻服务
- 配置 Nginx 反向代理
- 启动网站

默认访问：

http://你的域名或服务器IP

注意：

- 如果你没有域名，网站域名处直接填服务器公网 IP。
- 如果服务器不是 Ubuntu/Debian/CentOS，可能需要手动安装 python3、nginx、unzip。
- 如果 SSH 不是 22 端口，需要手动修改脚本里的 scp/ssh 命令，加上 -P 端口。
- 生产环境建议后续配置 HTTPS。
