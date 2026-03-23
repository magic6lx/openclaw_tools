import React, { useState, useEffect } from 'react';
import { Card, Button, Steps, Alert, Descriptions, Tag, Space, message, Spin, Progress, Typography, Collapse, Modal } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, DownloadOutlined, SyncOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import openclawInstallService from '../services/openclawInstallService';

const { Step } = Steps;
const { Panel } = Collapse;
const { Title, Paragraph, Text } = Typography;

const OpenClawInstall = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState(null);
  const [installResult, setInstallResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [upgradeMode, setUpgradeMode] = useState(false);

  useEffect(() => {
    checkSystem();
  }, []);

  const checkSystem = async () => {
    try {
      setLoading(true);
      const response = await openclawInstallService.checkSystem();
      if (response.success) {
        setSystemCheck(response.data);
      } else {
        message.error('系统检查失败');
      }
    } catch (error) {
      message.error('系统检查失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    try {
      setLoading(true);
      const response = await openclawInstallService.installOpenClaw(upgradeMode);
      if (response.success) {
        message.success(response.message);
        setInstallResult(response);
        setCurrentStep(3);
      } else {
        message.error(response.message || '安装失败');
        if (response.suggestions && response.suggestions.length > 0) {
          Modal.warning({
            title: '安装失败',
            content: (
              <div>
                <p>{response.message}</p>
                <p>建议的解决方案：</p>
                <ul>
                  {response.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ),
            okText: '知道了'
          });
        }
      }
    } catch (error) {
      message.error('安装失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      const response = await openclawInstallService.verifyInstallation();
      if (response.success) {
        setInstallResult(response.data);
        message.success('验证完成');
      } else {
        message.error('验证失败');
      }
    } catch (error) {
      message.error('验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async () => {
    try {
      setLoading(true);
      const response = await openclawInstallService.getInstallLogs();
      if (response.success) {
        setLogs(response.data.lines);
        setShowLogs(true);
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <Card title="系统检查" extra={<CheckCircleOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {systemCheck && (
          <>
            <Alert
              message="系统环境检查"
              description="正在检查您的系统环境是否满足OpenClaw安装要求"
              type="info"
              showIcon
            />
            
            <Descriptions bordered column={1}>
              <Descriptions.Item label="操作系统">
                <Tag color="blue">{systemCheck.platform}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="系统架构">
                <Tag color="purple">{systemCheck.arch}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Node版本">
                <Tag color={systemCheck.nodeVersion.satisfies ? 'green' : 'red'}>
                  {systemCheck.nodeVersion.current}
                  {!systemCheck.nodeVersion.satisfies && (
                    <span style={{ marginLeft: 8 }}>
                      (需要 {systemCheck.nodeVersion.required}+)
                    </span>
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="npm状态">
                {systemCheck.npmInstalled ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    已安装 (版本: {systemCheck.npmVersion})
                  </Tag>
                ) : (
                  <Tag color="red" icon={<ExclamationCircleOutlined />}>
                    未安装
                  </Tag>
                )}
              </Descriptions.Item>
              {systemCheck.npmPrefix && (
                <Descriptions.Item label="npm前缀">
                  <Text code>{systemCheck.npmPrefix}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="磁盘空间">
                {systemCheck.diskSpace ? (
                  <div>
                    {systemCheck.diskSpace.map((disk, index) => (
                      <div key={index} style={{ marginBottom: 4 }}>
                        <Tag color={disk.sufficient ? 'green' : 'orange'}>
                          {disk.drive}: {disk.freeSpace} 可用 / {disk.totalSpace} 总计
                        </Tag>
                        {!disk.sufficient && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            空间不足 (建议至少1GB)
                          </Tag>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Tag color="red">检查失败</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="网络连接">
                {systemCheck.networkConnection ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    正常 ({systemCheck.networkConnection.registry || '官方源'})
                  </Tag>
                ) : (
                  <Tag color="red" icon={<ExclamationCircleOutlined />}>
                    无法连接npm registry
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="管理员权限">
                {systemCheck.permissions ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    有权限
                  </Tag>
                ) : (
                  <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                    可能需要管理员权限
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="OpenClaw状态">
                {systemCheck.openclawInstalled ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    已安装 {systemCheck.openclawVersion ? `(版本: ${systemCheck.openclawVersion})` : ''}
                  </Tag>
                ) : (
                  <Tag color="red" icon={<ExclamationCircleOutlined />}>
                    未安装
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              message="依赖说明"
              description={
                <div>
                  <p><strong>Node.js:</strong> JavaScript运行环境，OpenClaw的基础依赖</p>
                  <p><strong>npm:</strong> Node.js包管理器，用于安装和管理OpenClaw</p>
                  <p><strong>磁盘空间:</strong> 至少需要1GB可用空间</p>
                  <p><strong>网络连接:</strong> 需要连接npm registry下载OpenClaw</p>
                  <p><strong>管理员权限:</strong> 全局安装可能需要管理员权限</p>
                  <p><strong>OpenClaw:</strong> 如果已安装，可以选择升级模式更新到最新版本</p>
                  <p><strong>说明:</strong> npm通常随Node.js一起安装，如果Node已安装但npm未安装，系统会尝试自动安装npm</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />

            {systemCheck.nodeVersion.satisfies && systemCheck.npmInstalled && 
             systemCheck.diskSpace?.some(disk => disk.sufficient) && 
             systemCheck.networkConnection ? (
              <Alert
                message="系统环境满足要求"
                description="您的系统环境满足OpenClaw的安装要求，可以继续安装"
                type="success"
                showIcon
              />
            ) : (
              <Alert
                message="系统环境不满足要求"
                description={
                  <div>
                    {!systemCheck.nodeVersion.satisfies && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>Node版本不满足要求：</strong>
                        <p>当前: {systemCheck.nodeVersion.current}</p>
                        <p>需要: {systemCheck.nodeVersion.required}+</p>
                        <p>请访问 <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">Node.js官网</a> 下载安装</p>
                      </div>
                    )}
                    {!systemCheck.npmInstalled && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>npm未安装：</strong>
                        <p>系统将在安装过程中自动尝试安装npm</p>
                        <p>如果自动安装失败，请手动安装npm</p>
                        <p>Windows: 使用winget安装或访问Node.js官网</p>
                        <p>macOS: 使用brew安装或访问Node.js官网</p>
                        <p>Linux: 使用包管理器安装或访问Node.js官网</p>
                      </div>
                    )}
                    {!systemCheck.diskSpace?.some(disk => disk.sufficient) && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>磁盘空间不足：</strong>
                        <p>至少需要1GB可用空间</p>
                        <p>请清理磁盘空间或选择其他安装位置</p>
                      </div>
                    )}
                    {!systemCheck.networkConnection && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>网络连接问题：</strong>
                        <p>无法连接到npm registry</p>
                        <p>可能的原因：</p>
                        <ul>
                          <li>网络连接不稳定或断开</li>
                          <li>防火墙阻止了npm仓库访问</li>
                          <li>需要使用代理或镜像源</li>
                        </ul>
                        <p>解决方案：</p>
                        <ul>
                          <li>检查网络连接</li>
                          <li>临时关闭防火墙测试</li>
                          <li>使用npm镜像源：npm config set registry https://registry.npmmirror.com</li>
                          <li>配置代理（如果需要）</li>
                        </ul>
                      </div>
                    )}
                  </div>
                }
                type="error"
                showIcon
              />
            )}
          </>
        )}
      </Space>
      
      <Space>
        <Button onClick={checkSystem} loading={loading}>
          重新检查
        </Button>
        {systemCheck?.nodeVersion.satisfies && !systemCheck?.openclawInstalled && (
          <Button type="primary" onClick={() => setCurrentStep(1)}>
            下一步
          </Button>
        )}
        {systemCheck?.openclawInstalled && (
          <Alert
            message="OpenClaw已安装"
            description={
              <div>
                <p>检测到您的系统已经安装了OpenClaw（版本: {systemCheck.openclawVersion || '未知'}）</p>
                <p>您可以直接使用已安装的OpenClaw，无需重复安装。</p>
                <p>如需更新到最新版本，请使用命令：<code>npm update -g openclaw</code></p>
              </div>
            }
            type="success"
            showIcon
          />
        )}
      </Space>
    </Card>
  );

  const renderStep2 = () => (
    <Card title="选择安装模式" extra={<DownloadOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="安装模式说明"
          description={
            <div>
              <Paragraph>
                <Text strong>全新安装：</Text>首次安装OpenClaw
              </Paragraph>
              <Paragraph>
                <Text strong>升级安装：</Text>更新已安装的OpenClaw到最新版本
              </Paragraph>
              {systemCheck?.openclawInstalled && (
                <Alert
                  message="检测到OpenClaw已安装"
                  description={`当前版本: ${systemCheck.openclawVersion || '未知'}，建议选择升级安装模式`}
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          }
          type="info"
          showIcon
        />
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type={upgradeMode ? 'default' : 'primary'}
            size="large"
            block
            onClick={() => {
              setUpgradeMode(false);
              setCurrentStep(2);
            }}
          >
            <DownloadOutlined /> 全新安装
          </Button>
          
          <Button
            type={upgradeMode ? 'primary' : 'default'}
            size="large"
            block
            onClick={() => {
              setUpgradeMode(true);
              setCurrentStep(2);
            }}
          >
            <SyncOutlined /> 升级安装
          </Button>
        </Space>
      </Space>
      
      <Space>
        <Button onClick={() => setCurrentStep(0)}>
          上一步
        </Button>
      </Space>
    </Card>
  );

  const renderStep3 = () => (
    <Card title={upgradeMode ? '升级OpenClaw' : '安装OpenClaw'} extra={<LoadingOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message={upgradeMode ? '升级OpenClaw' : '安装OpenClaw'}
          description={
            <div>
              <Paragraph>
                <Text>安装命令：</Text>
                <Text code>{upgradeMode ? 'npm update -g openclaw' : 'npm install -g openclaw'}</Text>
              </Paragraph>
              <Paragraph>
                <Text>如果npm未安装，系统将自动安装npm后再安装OpenClaw</Text>
              </Paragraph>
              <Paragraph>
                <Text>安装后自动验证：</Text>
              </Paragraph>
              <ul>
                <li>检查OpenClaw版本</li>
                <li>运行openclaw doctor检查配置</li>
                <li>验证PATH配置</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
        />
        
        {installResult && (
          <Alert
            message={installResult.message}
            description="安装日志已记录到服务器，可以点击查看日志按钮查看详细信息"
            type="success"
            showIcon
          />
        )}
      </Space>
      
      <Space>
        <Button onClick={() => setCurrentStep(1)}>
          上一步
        </Button>
        <Button type="primary" onClick={handleInstall} loading={loading}>
          {upgradeMode ? '开始升级' : '开始安装'}
        </Button>
      </Space>
    </Card>
  );

  const renderStep4 = () => (
    <Card title="安装完成" extra={<CheckCircleOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {installResult && (
          <>
            <Alert
              message={installResult.message}
              description="OpenClaw安装/升级成功！"
              type="success"
              showIcon
            />
            
            <Descriptions bordered column={1}>
              <Descriptions.Item label="安装日志">
                <Button icon={<FileTextOutlined />} onClick={handleViewLogs}>
                  查看日志
                </Button>
              </Descriptions.Item>
              <Descriptions.Item label="验证安装">
                <Button icon={<CheckCircleOutlined />} onClick={handleVerify} loading={loading}>
                  验证安装
                </Button>
              </Descriptions.Item>
            </Descriptions>

            {installResult.data && installResult.data.allPassed && (
              <Alert
                message="验证通过"
                description="OpenClaw安装验证通过，所有检查项都正常"
                type="success"
                showIcon
              />
            )}
          </>
        )}
      </Space>
      
      <Space>
        <Button onClick={() => setCurrentStep(0)}>
          重新开始
        </Button>
        <Button type="primary" onClick={() => window.location.href = '/dashboard'}>
          返回首页
        </Button>
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2}>OpenClaw一键安装</Title>
      <Paragraph>
        帮助您快速安装或升级OpenClaw，自动解决安装过程中的问题
      </Paragraph>
      
      <Steps current={currentStep} style={{ marginBottom: '32px' }}>
        <Step title="系统检查" description="检查系统环境" />
        <Step title="选择模式" description="选择安装或升级" />
        <Step title="执行安装" description="安装OpenClaw" />
        <Step title="完成验证" description="验证安装结果" />
      </Steps>

      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
      {currentStep === 3 && renderStep4()}

      <Modal
        title="安装日志"
        open={showLogs}
        onCancel={() => setShowLogs(false)}
        footer={[
          <Button key="close" onClick={() => setShowLogs(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          {logs.length === 0 ? (
            <Alert message="暂无日志" type="info" />
          ) : (
            <pre style={{ fontSize: '12px', lineHeight: '1.5' }}>
              {logs.join('\n')}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default OpenClawInstall;