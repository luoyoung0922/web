Windows Server deployment

What this bundle does:
- Packages the app from the bundled project folder
- Copies it to your Windows Server over PowerShell Remoting
- Creates a Python virtual environment
- Installs dependencies
- Registers a Scheduled Task that starts the app on boot

Requirements on the server:
- Windows Server with PowerShell Remoting enabled
- Python 3 installed and available as `python`
- Permission to create scheduled tasks
- Port 8000 allowed in Windows Firewall, or change the app port when prompted

How to run:
1. Double-click `双击运行部署.bat`
2. Enter the server IP or computer name
3. Enter Windows admin credentials when prompted
4. Fill in the remote folder, port, domain/IP, admin password, and optional AI settings

Important:
- If WinRM is disabled on the server, enable PowerShell Remoting first.
- If the server is only accessible by RDP, you can still use the script inside a PowerShell window on your own PC, but remoting must be allowed.
- The app runs as a Scheduled Task named `QuizSite`.
