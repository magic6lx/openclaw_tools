1. 服务器用的是 Tauri 版本 ( openclaw-launcher )，不是 Electron 版本。
2. exe在本地编译好，上传到服务器后运行。（注意控制大小不超过10MB）
3. 云服务的项目目录是：/opt/openclaw_tool_server/
4. 修改代码后自动提交github
5. 所有的检查，安装，都是基于客户端的，不要做成服务端的