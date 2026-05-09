---
alwaysApply: true
---
1. 云服务的项目目录是：/opt/openclaw_tool_server/
2. 修改代码后自动提交github,隐私信息禁止提交到git
3. openclaw的指令操作是基于客户端的，不要做成服务端的
4. openclaw的官方档在reference目录下，你不懂的时候去查询，禁止编造相关的操作指令或配置。
4.1 所有的操作指令，都必须基于openclaw的官方档。
4.2 所有的配置，都必须基于openclaw的官方档。
5. 禁止mock任何数据，包括数据库、文件、网络等。
6. 禁止把令牌信息和密钥信息提交到github。
7. 部署到服务器的指令参考docs/requirements/部署指令.md。
8. openclaw.json有严格的格式，不能随便加字段，必须严格遵守openclaw的官方档。
9. 编码时注意规则（system_config），不要把规则硬编码到代码中（可以直接修改数据库中的规则）。                                   │
9.1 manifest 类: 决定哪些文件要同步                                     │
9.2 migration 类: 决定内容如何变换（路径/代理/模型映射）                  │
9.3 system 类: 决定允许执行哪些 CLI 命令
**定位不要弄错了，manifest是文件级别，migration是文件里面的内容级别**

