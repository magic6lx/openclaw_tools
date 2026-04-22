---
alwaysApply: true
---
1. exe在本地编译好，上传到服务器后运行。（注意控制大小不超过10MB）
2. 云服务的项目目录是：/opt/openclaw_tool_server/
3. 修改代码后自动提交github,隐私信息禁止提交到git
4. 所有的检查，安装，都是基于客户端的，不要做成服务端的
5. openclaw的文档在reference目录下，禁止编造相关的操作指令
6. 如果中文路径 导致 Rust 编译失败，就尝试指定一个没有中文的构建目录，成功后移动进来
7. launcher 托盘 UI 是独立的项目 src-ui 目录下
